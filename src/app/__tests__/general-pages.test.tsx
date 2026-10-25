jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())
jest.mock('@/lib/api/student')
jest.mock('@/lib/api/auth')
jest.mock('@/components/dashboard/Sidebar', () => ({
  __esModule: true,
  default: ({ enrollments }: any) => <div data-testid="sidebar">{enrollments.length} enrollments</div>,
}))
jest.mock('@/components/dashboard/ActivityFeed', () => ({
  __esModule: true,
  default: ({ attempts, loading, user }: any) => (
    <div data-testid="feed">{`${attempts.length} attempts, loading=${loading}, user=${user?.id ?? 'none'}`}</div>
  ),
}))
jest.mock('@/components/dashboard/AchievementPanel', () => ({
  __esModule: true,
  default: ({ earnedBadges, referralSummary }: any) => (
    <div data-testid="achievements">{`${earnedBadges.length} badges, code=${referralSummary?.referral_code ?? 'none'}`}</div>
  ),
}))
jest.mock('@/components/FeedbackForm', () => ({ __esModule: true, default: () => <form aria-label="feedback form" /> }))
jest.mock('@/app/student/courses/CourseList', () => ({ __esModule: true, default: () => <div>course list</div> }))

import { act, screen, waitFor } from '@testing-library/react'
import apiClient from '@/lib/api/client'
import * as authApi from '@/lib/api/auth'
import * as studentApi from '@/lib/api/student'
import Home from '@/app/page'
import InfoPage from '@/app/info/page'
import DashboardPage from '@/app/dashboard/page'
import FeedbackPage, { metadata as feedbackMetadata } from '@/app/student/feedback/page'
import ExamCoursesPage from '@/app/student/courses/page'
import VideoCoursesPage from '@/app/student/video-courses/page'
import SubjectsRedirect from '@/app/admin/subjects/page'
import { metadata as layoutMetadata, viewport } from '@/app/layout'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { reply, type MockClient } from '@/test-utils/api'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const student = studentApi as jest.Mocked<typeof studentApi>
const client = apiClient as unknown as MockClient

const stats = {
  total_students: 1250,
  total_courses: 12,
  total_exams: 340,
  total_attempts: 9000,
  top_courses: [
    { id: 'c1', title: 'Combined Maths', subject: 'Combined Mathematics', grade: 13, price: 2500, image_url: null, stream_ids: ['s1', 's2', 's3'] },
    { id: 'c2', title: 'Free Science', subject: 'Agriculture', grade: 10, price: 0, image_url: null, stream_ids: [] },
  ],
}
const leaders = [
  { full_name: 'Amaya', school: 'Royal', district: 'Colombo', score: 98, grade: 13 },
  { full_name: 'Bimal', school: 'Trinity', district: 'Kandy', score: 95, grade: 13 },
  { full_name: 'Chamari', school: 'Visakha', district: 'Galle', score: 91, grade: 12 },
]

beforeEach(() => {
  nav.reset()
  jest.resetAllMocks()
  student.getPlatformStats.mockResolvedValue(stats as any)
  student.getRankingExams.mockResolvedValue([{ exam_id: 'e1', title: 'Paper 1' }] as any)
  student.getRankingsLeaderboard.mockResolvedValue(leaders as any)
  student.getStreams.mockResolvedValue([{ id: 's1', name: 'Maths' }, { id: 's2', name: 'Bio' }] as any)
  student.getMyEnrollments.mockResolvedValue([] as any)
  student.getMyAttempts.mockResolvedValue([])
  student.getReferralSummary.mockResolvedValue({ referral_code: 'EDU42' } as any)
  client.get.mockResolvedValue(reply({ earned_badges: [], available_badges: [] }))
})

describe('robots and sitemap', () => {
  it('allows every crawler and points at the sitemap', () => {
    expect(robots()).toEqual({
      rules: [{ userAgent: '*', allow: '/' }],
      sitemap: 'https://www.edura.com/sitemap.xml',
      host: 'https://www.edura.com',
    })
  })

  it('lists the public pages with the home page first', () => {
    const entries = sitemap()
    expect(entries.map((e) => e.url)).toEqual([
      'https://www.edura.com/',
      'https://www.edura.com/login',
      'https://www.edura.com/register',
      'https://www.edura.com/forgot-password',
      'https://www.edura.com/info',
    ])
    expect(entries[0]).toMatchObject({ priority: 1, changeFrequency: 'daily' })
    entries.forEach((e) => expect(e.lastModified).toBeInstanceOf(Date))
  })
})

describe('Root layout metadata', () => {
  it('sets the title template, canonical url and theme colour', () => {
    expect(layoutMetadata.title).toEqual({ default: 'Edura | Online Exam Preparation Platform', template: '%s | Edura' })
    expect(layoutMetadata.metadataBase?.href).toBe('https://www.edura.com/')
    expect(layoutMetadata.alternates?.canonical).toBe('/')
    expect(layoutMetadata.robots).toMatchObject({ index: true, follow: true })
    expect(viewport).toMatchObject({ themeColor: '#0d9488', width: 'device-width' })
  })
})

describe('Thin wrapper pages', () => {
  it('both course pages render the shared course list', () => {
    const { unmount } = renderWithStore(<ExamCoursesPage />)
    expect(screen.getByText('course list')).toBeInTheDocument()
    unmount()
    renderWithStore(<VideoCoursesPage />)
    expect(screen.getByText('course list')).toBeInTheDocument()
  })

  it('the old subjects page redirects to streams', () => {
    renderWithStore(<SubjectsRedirect />)
    expect(nav.router.replace).toHaveBeenCalledWith('/admin/streams')
  })

  it('the feedback page shows the form and its metadata', () => {
    renderWithStore(<FeedbackPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('We value your Feedback')
    expect(screen.getByRole('form', { name: 'feedback form' })).toBeInTheDocument()
    expect(feedbackMetadata.title).toBe('Give Feedback | Edura')
  })
})

describe('Home page', () => {
  it('loads stats, ranking exams, streams and then the top three', async () => {
    renderWithStore(<Home />)
    await waitFor(() => expect(student.getRankingsLeaderboard).toHaveBeenCalledWith('e1', undefined, 3, undefined))
    expect(student.getPlatformStats).toHaveBeenCalledTimes(1)
    expect(student.getStreams).toHaveBeenCalledTimes(1)
  })

  it('shows popular courses with stream names, prices and links', async () => {
    renderWithStore(<Home />)
    const course = await screen.findByRole('link', { name: /Combined Maths/ })
    expect(course).toHaveAttribute('href', '/student/courses/c1')
    expect(course).toHaveTextContent('LKR 2,500')
    expect(course).toHaveTextContent('Grade 13')
    expect(await screen.findByText('Maths')).toBeInTheDocument()
    expect(screen.getByText('Bio')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Free Science/ })).toHaveTextContent('Free')
  })

  it('shows skeleton cards until stats arrive', () => {
    student.getPlatformStats.mockReturnValue(new Promise(() => {}))
    const { container } = renderWithStore(<Home />)
    expect(container.querySelectorAll('.animate-pulse.bg-white')).toHaveLength(4)
    expect(screen.getByText(/thousands of students/)).toBeInTheDocument()
  })

  it('shows the live leaderboard with medals', async () => {
    renderWithStore(<Home />)
    expect(await screen.findByText('Top Performers')).toBeInTheDocument()
    expect(screen.getByText('Amaya')).toBeInTheDocument()
    expect(screen.getByText('#1 Ranked')).toBeInTheDocument()
    expect(screen.getByText('Royal · Colombo')).toBeInTheDocument()
    expect(screen.getByText('98%')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View Full Rankings/ })).toHaveAttribute('href', '/student/rankings')
  })

  it('names the student count in the call to action', async () => {
    renderWithStore(<Home />)
    expect(await screen.findByText('1,250+ students')).toBeInTheDocument()
  })

  it('does not refetch what the store already has', () => {
    renderWithStore(<Home />, {
      store: makeStore({
        studentDashboard: { platformStats: stats as any, rankingExams: [{ exam_id: 'e1' }] as any, leaderboard: leaders as any },
        admin: { streams: [{ id: 's1', name: 'Maths' }] as any },
      }),
    })
    expect(student.getPlatformStats).not.toHaveBeenCalled()
    expect(student.getRankingExams).not.toHaveBeenCalled()
    expect(student.getStreams).not.toHaveBeenCalled()
    expect(student.getRankingsLeaderboard).not.toHaveBeenCalled()
  })

  it.each(['admin', 'super_admin'])('sends a signed-in %s to the admin dashboard', (role) => {
    renderWithStore(<Home />, { store: makeStore({ auth: { isAuthenticated: true, user: { id: '1', role } as any } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/admin/dashboard')
  })

  describe('platform statistics count-up', () => {
    const originalObserver = (globalThis as any).IntersectionObserver
    let observers: ((isIntersecting: boolean) => void)[]
    // Other widgets observe too, so "scrolling into view" notifies every observer.
    const reveal = (isIntersecting: boolean) => observers.forEach((notify) => notify(isIntersecting))
    let frames: FrameRequestCallback[]
    let raf: jest.SpyInstance

    beforeEach(() => {
      observers = []
      ;(globalThis as any).IntersectionObserver = class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          observers.push((isIntersecting) => cb([{ isIntersecting }]))
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return []
        }
      }
      frames = []
      raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
    })

    afterEach(() => {
      ;(globalThis as any).IntersectionObserver = originalObserver
      raf.mockRestore()
    })

    const runFrame = (time: number) =>
      act(() => {
        const pending = frames
        frames = []
        pending.forEach((cb) => cb(time))
      })
    const statValue = (label: string) => screen.getByText(label).previousElementSibling!.textContent

    it('stays at zero until the section scrolls into view', async () => {
      renderWithStore(<Home />)
      await screen.findByText('Combined Maths')
      act(() => reveal(false))
      expect(frames).toHaveLength(0)
      expect(statValue('Registered Students')).toBe('0+')
      expect(statValue('Active Courses')).toBe('0')
    })

    it('counts up to the real figures, abbreviating thousands', async () => {
      renderWithStore(<Home />)
      await screen.findByText('Combined Maths')
      act(() => reveal(true))
      expect(frames.length).toBeGreaterThan(0)
      runFrame(1000) // animation starts
      runFrame(1000 + 700) // part way: eased, so strictly between 0 and the target
      const partial = Number(statValue('Active Courses'))
      expect(partial).toBeGreaterThan(0)
      expect(partial).toBeLessThanOrEqual(12)

      runFrame(1000 + 10_000) // well past every duration
      expect(statValue('Registered Students')).toBe('1.3k+')
      expect(statValue('Active Courses')).toBe('12')
      expect(statValue('Practice Exams')).toBe('340+')
      expect(statValue('Exam Attempts')).toBe('9k+') // exact thousands drop the decimal
    })
  })

  it('leaves students on the home page', () => {
    renderWithStore(<Home />, { store: makeStore({ auth: { isAuthenticated: true, user: { id: '1', role: 'student' } as any } }) })
    expect(nav.router.push).not.toHaveBeenCalled()
  })
})

describe('Info page', () => {
  it('fetches platform stats and shows them', async () => {
    renderWithStore(<InfoPage />)
    expect(await screen.findByText('1,250+')).toBeInTheDocument()
    expect(screen.getByText('340+')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('9,000+')).toBeInTheDocument()
  })

  it('shows dashes while stats are loading', () => {
    student.getPlatformStats.mockReturnValue(new Promise(() => {}))
    renderWithStore(<InfoPage />)
    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('skips the fetch when stats are already loaded', () => {
    renderWithStore(<InfoPage />, { store: makeStore({ studentDashboard: { platformStats: stats as any } }) })
    expect(student.getPlatformStats).not.toHaveBeenCalled()
  })

  it('lists the FAQs and contact details', () => {
    renderWithStore(<InfoPage />)
    expect(screen.getByText('Who is Edura for?')).toBeInTheDocument()
    expect(screen.getByText('How are rankings calculated?')).toBeInTheDocument()
    expect(screen.getByText('support@edura.lk')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create Free Account' })).toHaveAttribute('href', '/register')
  })
})

describe('Dashboard page', () => {
  const signedIn = (extra: any = {}) =>
    makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: '7', role: 'student' } as any }, ...extra })

  it('shows a loader until auth is initialised', () => {
    renderWithStore(<DashboardPage />)
    expect(screen.getByText('Loading Edura Hub...')).toBeInTheDocument()
    expect(nav.router.push).not.toHaveBeenCalled()
  })

  it('sends visitors to log in, back to the dashboard', () => {
    nav.setSearch({ tab: 'badges' })
    nav.pathname = '/dashboard'
    renderWithStore(<DashboardPage />, { store: makeStore({ auth: { isInitialized: true } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fdashboard%3Ftab%3Dbadges')
  })

  it('loads enrollments, attempts, referrals and badges', async () => {
    renderWithStore(<DashboardPage />, { store: signedIn() })
    await waitFor(() => expect(client.get).toHaveBeenCalledWith('/api/assessments/badges/dashboard'))
    expect(student.getMyEnrollments).toHaveBeenCalledWith(0, 20)
    expect(student.getMyAttempts).toHaveBeenCalledWith(10)
    expect(student.getReferralSummary).toHaveBeenCalled()
  })

  it('fetches the profile when signed in without one', async () => {
    ;(authApi.getCurrentUser as jest.Mock).mockResolvedValue({ id: '7', role: 'student' })
    renderWithStore(<DashboardPage />, { store: makeStore({ auth: { isAuthenticated: true, isInitialized: true } }) })
    await waitFor(() => expect(authApi.getCurrentUser).toHaveBeenCalled())
    expect(await screen.findByText(/user=7/)).toBeInTheDocument()
  })

  it('passes store data to the three columns', async () => {
    renderWithStore(<DashboardPage />, {
      store: signedIn({ studentDashboard: { enrollments: [{ id: 'en1' }, { id: 'en2' }], attempts: [{ id: 'a1' }] } }),
    })
    expect(screen.getByTestId('sidebar')).toHaveTextContent('2 enrollments')
    expect(screen.getByTestId('feed')).toHaveTextContent('1 attempts')
    expect(screen.getByTestId('feed')).toHaveTextContent('user=7')
    await waitFor(() => expect(screen.getAllByTestId('achievements')[0]).toHaveTextContent('code=EDU42'))
    expect(screen.getAllByTestId('achievements')).toHaveLength(2) // desktop column + mobile fallback
  })
})
