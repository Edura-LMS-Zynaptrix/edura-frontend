jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('@/lib/api/auth')
jest.mock('@/lib/api/student')

import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as authApi from '@/lib/api/auth'
import * as studentApi from '@/lib/api/student'
import AdminNavbar from '@/components/AdminNavbar'
import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'
import ProfileDropdown from '@/components/ProfileDropdown'
import { useAppSelector } from '@/lib/redux/hooks'
import { Providers } from '@/lib/redux/provider'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const student = {
  id: '7',
  email: 'ama@x.lk',
  role: 'student',
  is_active: true,
  full_name: 'Ama Perera',
  profile: { name: 'Ama Perera', grade: 11, school: 'Royal College' },
}

const signedIn = (user: any = student, extra: any = {}) =>
  makeStore({ auth: { isAuthenticated: true, user, ...extra } })

beforeEach(() => {
  nav.reset()
  jest.resetAllMocks()
  ;(authApi.logoutSession as jest.Mock).mockResolvedValue(undefined)
  ;(studentApi.getReferralSummary as jest.Mock).mockResolvedValue({ wallet_credits: 4 })
})

describe('Footer', () => {
  it.each(['/login', '/register', '/admin/dashboard'])('is hidden on %s', (path) => {
    nav.pathname = path
    const { container } = renderWithStore(<Footer />)
    expect(container).toBeEmptyDOMElement()
  })

  it('links to the main areas elsewhere', () => {
    nav.pathname = '/student/courses'
    renderWithStore(<Footer />)
    expect(screen.getByRole('link', { name: 'Browse Courses' })).toHaveAttribute('href', '/student/courses')
    expect(screen.getByRole('link', { name: 'Student Feedback' })).toHaveAttribute('href', '/student/feedback')
    expect(screen.getByText(/© 2026 Edura/)).toBeInTheDocument()
  })
})

describe('Navbar', () => {
  it.each(['/login', '/register'])('is hidden on %s', (path) => {
    nav.pathname = path
    const { container } = renderWithStore(<Navbar />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the admin console on admin pages', () => {
    nav.pathname = '/admin/courses'
    renderWithStore(<Navbar />, { store: signedIn({ ...student, role: 'admin' }) })
    expect(screen.getByText('Admin Console')).toBeInTheDocument()
  })

  it('offers sign in to visitors and highlights the current page', () => {
    nav.pathname = '/student/courses/10'
    renderWithStore(<Navbar />)
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: 'Rankings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exam Courses' }).className).toContain('text-teal-700')
    expect(screen.queryByText('My Courses')).not.toBeInTheDocument()
  })

  it.each([
    ['student', 'My Courses', '/student/my-courses'],
    ['teacher', 'Dashboard', '/dashboard'],
    ['admin', 'Admin Portal', '/admin/dashboard'],
  ])('gives a signed-in %s their portal link', (role, label, href) => {
    nav.pathname = '/'
    renderWithStore(<Navbar />, { store: signedIn({ ...student, role }) })
    expect(screen.getAllByRole('link', { name: label })[0]).toHaveAttribute('href', href)
    expect(screen.getByRole('link', { name: 'My Rankings' })).toBeInTheDocument()
  })

  it('hides navigation until the profile is completed', () => {
    renderWithStore(<Navbar />, { store: signedIn(student, { needsProfileCompletion: true }) })
    expect(screen.queryByText('Exam Courses')).not.toBeInTheDocument()
    expect(screen.queryByText('My Courses')).not.toBeInTheDocument()
  })

  it('opens and closes the mobile menu, closing it on navigation', async () => {
    const user = userEvent.setup()
    nav.pathname = '/'
    const { rerender } = renderWithStore(<Navbar />)
    expect(screen.getAllByRole('link', { name: 'Sign In' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }))
    expect(screen.getAllByRole('link', { name: 'Sign In' })).toHaveLength(2)

    nav.pathname = '/info'
    rerender(<Navbar />)
    expect(screen.getAllByRole('link', { name: 'Sign In' })).toHaveLength(1)
  })

  it('shows the portal in the mobile menu for signed-in users', async () => {
    renderWithStore(<Navbar />, { store: signedIn() })
    await userEvent.click(screen.getByRole('button', { name: 'Toggle menu' }))
    expect(screen.getAllByRole('link', { name: 'My Courses' }).length).toBeGreaterThan(1)
  })
})

describe('AdminNavbar', () => {
  it('lists the admin areas and marks the current one', () => {
    nav.pathname = '/admin/payments/bank-accounts'
    renderWithStore(<AdminNavbar />, { store: signedIn({ ...student, role: 'admin' }) })
    expect(screen.getByRole('link', { name: 'Payments' }).className).toContain('text-teal-700')
    expect(screen.getByRole('link', { name: 'Students' }).className).not.toContain('text-teal-700')
    expect(screen.getByRole('link', { name: 'Admins' })).toHaveAttribute('href', '/admin/admins')
  })

  it('hides admin management from non-admins', () => {
    nav.pathname = '/admin/dashboard'
    renderWithStore(<AdminNavbar />, { store: signedIn({ ...student, role: 'teacher' }) })
    expect(screen.queryByRole('link', { name: 'Admins' })).not.toBeInTheDocument()
  })

  it('has a mobile menu with settings', async () => {
    nav.pathname = '/admin/admins'
    renderWithStore(<AdminNavbar />, { store: signedIn({ ...student, role: 'admin' }) })
    await userEvent.click(screen.getByRole('button', { name: 'Toggle menu' }))
    expect(screen.getByRole('link', { name: 'Manage Admins' }).className).toContain('text-teal-700')
    expect(screen.getByRole('link', { name: 'System Settings' })).toHaveAttribute('href', '/admin/settings')
  })
})

describe('Providers', () => {
  it('gives children the app store', () => {
    const Probe = () => <span>{useAppSelector((s) => (s.auth.isAuthenticated ? 'in' : 'out'))}</span>
    render(
      <Providers>
        <Probe />
      </Providers>
    )
    expect(screen.getByText('out')).toBeInTheDocument()
  })
})

describe('ProfileDropdown', () => {
  const open = async () => userEvent.click(screen.getAllByRole('button')[0])

  it('shows initials, name, grade and wallet credits for a student', async () => {
    const store = signedIn()
    renderWithStore(<ProfileDropdown />, { store })
    expect(screen.getByText('AP')).toBeInTheDocument()
    expect(screen.getByText('Grade 11')).toBeInTheDocument()
    await act(async () => {}) // let the referral summary load
    expect(studentApi.getReferralSummary).toHaveBeenCalled()

    await open()
    expect(screen.getByText('ama@x.lk')).toBeInTheDocument()
    expect(screen.getByText('Royal College')).toBeInTheDocument()
    expect(screen.getByText('Wallet Credits: 4')).toBeInTheDocument()
    for (const label of ['Dashboard', 'My Courses', 'My Analytics', 'My Rankings', 'My Badges', 'Profile Settings']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('shows admin links and no wallet for admins', async () => {
    renderWithStore(<ProfileDropdown />, { store: signedIn({ ...student, role: 'admin', profile: null }) })
    await open()
    expect(screen.getByRole('link', { name: 'Admin Dashboard' })).toHaveAttribute('href', '/admin/dashboard')
    expect(screen.getByRole('link', { name: 'Admin Settings' })).toBeInTheDocument()
    expect(screen.queryByText(/Wallet Credits/)).not.toBeInTheDocument()
    expect(studentApi.getReferralSummary).not.toHaveBeenCalled()
  })

  it('shows a plain dashboard link for teachers', async () => {
    renderWithStore(<ProfileDropdown />, { store: signedIn({ ...student, role: 'teacher' }) })
    await open()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it('falls back to the email name', () => {
    renderWithStore(<ProfileDropdown />, {
      store: signedIn({ id: '1', email: 'kamal@x.lk', role: 'teacher' }),
    })
    expect(screen.getByText('kamal')).toBeInTheDocument()
    expect(screen.getByText('KA')).toBeInTheDocument()
  })

  it('closes when clicking outside', async () => {
    renderWithStore(<ProfileDropdown />, { store: signedIn() })
    await open()
    expect(screen.getByText('Logout')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Logout')).not.toBeInTheDocument()
  })

  it.each([
    ['student', ['Dashboard', 'My Courses', 'My Analytics', 'My Rankings', 'My Badges', 'Profile Settings']],
    ['admin', ['Admin Dashboard', 'Admin Settings', 'Profile Settings']],
    ['teacher', ['Dashboard', 'Profile Settings']],
  ])('closes after following a %s menu link', async (role, labels) => {
    // jsdom can't navigate; stop the link's default action once React has handled the click.
    const stopNavigation = (e: Event) => e.preventDefault()
    document.addEventListener('click', stopNavigation)
    renderWithStore(<ProfileDropdown />, { store: signedIn({ ...student, role }) })
    for (const label of labels) {
      await open()
      fireEvent.click(screen.getByRole('link', { name: label }))
      expect(screen.queryByText('Logout')).not.toBeInTheDocument()
    }
    document.removeEventListener('click', stopNavigation)
  })

  it('logs out locally even if the server call fails', async () => {
    ;(authApi.logoutSession as jest.Mock).mockRejectedValue(new Error('offline'))
    localStorage.setItem('accessToken', 'a')
    const store = signedIn()
    renderWithStore(<ProfileDropdown />, { store })
    await open()
    await userEvent.click(screen.getByText('Logout'))
    expect(authApi.logoutSession).toHaveBeenCalled()
    expect(store.getState().auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(nav.router.push).toHaveBeenCalledWith('/')
  })

  it('shows a photo stored as profile_photo_url, and initials if it fails to load', () => {
    renderWithStore(<ProfileDropdown />, {
      store: signedIn({ ...student, profile: { ...student.profile, profile_photo_url: 'https://img/a.png' } }),
    })
    const img = screen.getByRole('img', { name: 'Ama Perera' })
    fireEvent.error(img)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('AP')).toBeInTheDocument()
  })

  // BUG: user_service returns the photo as `avatar_url` (and the name as
  // `name`), but the dropdown reads `profile_photo_url` / `full_name`, so an
  // uploaded profile photo never appears in the navbar.
  test.failing('shows the photo user_service actually returns (avatar_url)', () => {
    renderWithStore(<ProfileDropdown />, {
      store: signedIn({ ...student, profile: { ...student.profile, avatar_url: 'https://img/a.png' } }),
    })
    expect(screen.getByRole('img', { name: 'Ama Perera' })).toHaveAttribute('src', 'https://img/a.png')
  })
})
