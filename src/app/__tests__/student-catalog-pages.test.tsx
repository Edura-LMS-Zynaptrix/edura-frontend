jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())
jest.mock('@/lib/api/auth')
jest.mock('@/lib/api/student')

import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as authApi from '@/lib/api/auth'
import * as studentApi from '@/lib/api/student'
import CourseList from '@/app/student/courses/CourseList'
import MyCoursesPage from '@/app/student/my-courses/page'
import StudentClassPackagesPage from '@/app/student/class-packages/page'
import { clearNeedsProfileCompletion } from '@/lib/redux/slices/authSlice'
import { httpError } from '@/test-utils/api'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const auth = authApi as jest.Mocked<typeof authApi>
const student = studentApi as jest.Mocked<typeof studentApi>

const course = (id: string, extra: any = {}) => ({
  id,
  title: `Course ${id}`,
  subject: '',
  grade: 11,
  price: 1000,
  course_type: 'exam',
  image_url: null,
  stream_ids: [],
  is_enrolled: false,
  description: null,
  ...extra,
})
const catalog = [
  course('a', { title: 'Algebra Papers', price: 1500, grade: 10 }),
  course('b', { title: 'Biology Papers', price: 0, grade: 13, stream_ids: ['s1', 'zz'], is_enrolled: true, description: 'Past papers' }),
  course('c', { title: 'Chemistry Papers', price: 500, grade: 12 }),
  course('v', { title: 'Video Physics', course_type: 'video', price: 2000 }),
]
const pkg = (id: string, extra: any = {}) => ({
  id,
  name: `Package ${id}`,
  grade: 11,
  price: 0,
  is_enrolled: false,
  stream_name: null,
  description: null,
  ...extra,
})

const signedIn = (extra: any = {}) =>
  makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: '7', role: 'student' } as any }, ...extra })

beforeEach(() => {
  nav.reset()
  jest.resetAllMocks()
  student.getAvailableCourses.mockResolvedValue(catalog as any)
  student.getStreams.mockResolvedValue([{ id: 's1', name: 'Bio Stream' }] as any)
  student.getStudentClassPackages.mockResolvedValue([])
})

const titles = () =>
  screen.queryAllByRole('link').flatMap((a) => within(a).queryAllByRole('heading', { level: 3 })).map((h) => h.textContent)

describe('CourseList', () => {
  it('shows only exam courses on the exam page', async () => {
    nav.pathname = '/student/courses'
    renderWithStore(<CourseList />)
    expect(await screen.findByText('Algebra Papers')).toBeInTheDocument()
    expect(screen.queryByText('Video Physics')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Exam Courses')
    expect(screen.getAllByText('3 exams')[0]).toBeInTheDocument()
    expect(student.getStreams).toHaveBeenCalled()
  })

  it('shows only video courses on the video page', async () => {
    nav.pathname = '/student/video-courses'
    renderWithStore(<CourseList />)
    expect(await screen.findByText('Video Physics')).toBeInTheDocument()
    expect(screen.queryByText('Algebra Papers')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Video Courses')
    expect(screen.getAllByText('1 course')[0]).toBeInTheDocument()
  })

  it('renders a card with price, grade, streams and enrolment state', async () => {
    renderWithStore(<CourseList />)
    const bio = (await screen.findByText('Biology Papers')).closest('a')!
    expect(bio).toHaveAttribute('href', '/student/courses/b')
    expect(within(bio).getByText('Free')).toBeInTheDocument()
    expect(within(bio).getByText('Enrolled')).toBeInTheDocument()
    expect(within(bio).getByText('Open →')).toBeInTheDocument()
    expect(within(bio).getByText('Past papers')).toBeInTheDocument()
    expect(await within(bio).findByText('Bio Stream')).toBeInTheDocument()
    expect(within(bio).getByText('Stream')).toBeInTheDocument() // unknown stream id
    const algebra = screen.getByText('Algebra Papers').closest('a')!
    expect(within(algebra).getByText('LKR 1,500')).toBeInTheDocument()
    expect(within(algebra).getByText('Enrol →')).toBeInTheDocument()
  })

  it('searches by title and clears the search', async () => {
    renderWithStore(<CourseList />)
    await screen.findByText('Algebra Papers')
    await userEvent.type(screen.getByPlaceholderText('Search courses or subjects…'), 'chem')
    expect(titles()).toEqual(['Chemistry Papers'])
    await userEvent.clear(screen.getByPlaceholderText('Search courses or subjects…'))
    expect(titles()).toHaveLength(3)
  })

  it('filters by price and counts active filters', async () => {
    renderWithStore(<CourseList />)
    await screen.findByText('Algebra Papers')
    const sidebar = screen.getAllByText('Filters')[1].closest('div')!
    await userEvent.click(within(sidebar).getByLabelText('Free Only'))
    expect(titles()).toEqual(['Biology Papers'])
    await userEvent.click(within(sidebar).getByLabelText('Paid Only'))
    expect(titles()).toEqual(['Algebra Papers', 'Chemistry Papers'])
    expect(within(sidebar).getByText('1 filter active')).toBeInTheDocument()
  })

  it.each([
    ['price-asc', ['Biology Papers', 'Chemistry Papers', 'Algebra Papers']],
    ['price-desc', ['Algebra Papers', 'Chemistry Papers', 'Biology Papers']],
    ['grade-asc', ['Algebra Papers', 'Chemistry Papers', 'Biology Papers']],
    ['grade-desc', ['Biology Papers', 'Chemistry Papers', 'Algebra Papers']],
  ])('sorts by %s', async (option, expected) => {
    renderWithStore(<CourseList />)
    await screen.findByText('Algebra Papers')
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], option)
    expect(titles()).toEqual(expected)
  })

  it('clear all resets filters and sorting', async () => {
    renderWithStore(<CourseList />)
    await screen.findByText('Algebra Papers')
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'price-asc')
    await userEvent.click(screen.getAllByLabelText('Free Only')[0])
    await userEvent.click(screen.getByText('2 filters active'))
    expect(titles()).toEqual(['Algebra Papers', 'Biology Papers', 'Chemistry Papers'])
  })

  it('shows an empty state whose button clears filters', async () => {
    renderWithStore(<CourseList />)
    await screen.findByText('Algebra Papers')
    await userEvent.type(screen.getByPlaceholderText('Search courses or subjects…'), 'nothing matches')
    expect(screen.getByText('No exams found')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }))
    expect(titles()).toHaveLength(3)
  })

  it('uses the mobile drawer for filters', async () => {
    renderWithStore(<CourseList />)
    await screen.findByText('Algebra Papers')
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    const drawer = screen.getByRole('button', { name: 'Show 3 results' }).closest('.fixed')! as HTMLElement
    await userEvent.click(within(drawer).getByLabelText('Free Only'))
    await userEvent.click(within(drawer).getByRole('button', { name: 'Show 1 result' }))
    expect(screen.queryByRole('button', { name: /Show 1 result/ })).not.toBeInTheDocument()
    expect(titles()).toEqual(['Biology Papers'])
  })

  it('closes the mobile drawer from its close button and its backdrop', async () => {
    renderWithStore(<CourseList />)
    await screen.findByText('Algebra Papers')
    const openDrawer = () => userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    const drawer = () => screen.queryByRole('button', { name: /^Show \d+ results?$/ })?.closest('.fixed') as HTMLElement | null

    await openDrawer()
    const header = within(drawer()!).getByRole('heading', { name: 'Filters' }).parentElement!
    await userEvent.click(within(header).getByRole('button'))
    expect(drawer()).toBeFalsy()

    await openDrawer()
    await userEvent.click(drawer()!.firstElementChild as HTMLElement)
    expect(drawer()).toBeFalsy()
  })

  it('clears the search from the x inside the box', async () => {
    renderWithStore(<CourseList />)
    await screen.findByText('Algebra Papers')
    const box = screen.getByPlaceholderText('Search courses or subjects…')
    await userEvent.type(box, 'chem')
    await userEvent.click(within(box.parentElement!).getByRole('button'))
    expect(box).toHaveValue('')
    expect(titles()).toHaveLength(3)
  })

  it('filters by subject when courses carry one, and finds them by subject in search', async () => {
    student.getAvailableCourses.mockResolvedValue([
      course('m1', { title: 'Paper A', subject: 'Maths' }),
      course('m2', { title: 'Paper B', subject: 'Maths' }),
      course('p1', { title: 'Paper C', subject: 'Physics' }),
    ] as any)
    renderWithStore(<CourseList />)
    await screen.findByText('Paper A')
    const sidebar = screen.getAllByText('Filters')[1].closest('div')!
    const physics = within(sidebar).getByLabelText('Physics')
    expect(within(sidebar).getAllByRole('checkbox').map((c) => c.parentElement!.textContent)).toEqual(['Maths', 'Physics'])

    await userEvent.click(physics)
    expect(physics).toBeChecked()
    expect(titles()).toEqual(['Paper C'])
    expect(within(sidebar).getByText('1 filter active')).toBeInTheDocument()

    await userEvent.click(physics)
    expect(physics).not.toBeChecked()
    expect(titles()).toHaveLength(3)

    await userEvent.type(screen.getByPlaceholderText('Search courses or subjects…'), 'math')
    expect(titles()).toEqual(['Paper A', 'Paper B'])
  })

  it('shows skeletons while loading and the error when loading fails', async () => {
    let fail!: (e: unknown) => void
    student.getAvailableCourses.mockReturnValue(new Promise((_, reject) => { fail = reject }))
    const { container } = renderWithStore(<CourseList />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(6)
    await act(async () => fail(new Error('Courses unavailable')))
    expect(await screen.findByText('Courses unavailable')).toBeInTheDocument()
  })

  it('renders nothing while the profile still needs completing', () => {
    const { container } = renderWithStore(<CourseList />, { store: makeStore({ auth: { needsProfileCompletion: true } }) })
    expect(container).toBeEmptyDOMElement()
  })

  // Bug: CourseList returns before its hooks run, so finishing the profile
  // while the list is mounted changes the hook count and React throws.
  test.failing('keeps working when profile completion finishes while mounted', async () => {
    const store = makeStore({ auth: { needsProfileCompletion: true } })
    renderWithStore(<CourseList />, { store })
    act(() => { store.dispatch(clearNeedsProfileCompletion()) })
    expect(await screen.findByText('Algebra Papers')).toBeInTheDocument()
  })

  describe('class packages', () => {
    it('does not look up packages for visitors', async () => {
      renderWithStore(<CourseList />)
      await screen.findByText('Algebra Papers')
      expect(student.getStudentClassPackages).not.toHaveBeenCalled()
    })

    it('shows active and purchasable packages', async () => {
      student.getStudentClassPackages.mockResolvedValue([
        pkg('p1', { is_enrolled: true, stream_name: 'Maths' }),
        pkg('p2', { price: 3000, grade: 13 }),
        pkg('p3', { price: 2500, grade: 12, stream_name: 'Bio' }),
      ] as any)
      renderWithStore(<CourseList />, { store: signedIn() })
      expect(await screen.findByText('Class Access Active — Package p1')).toBeInTheDocument()
      expect(screen.getByText('Unlocks your selected subjects for Grade 12 & 13')).toBeInTheDocument()
      expect(screen.getByText('Unlocks your selected subjects for Grade 12 (Bio)')).toBeInTheDocument()
      expect(screen.getAllByRole('link', { name: 'Buy All' })[0]).toHaveAttribute(
        'href',
        '/payment?type=class_package&id=p2&name=Package%20p2&amount=3000'
      )
    })

    it('enrols in a free package and refreshes the list', async () => {
      student.getStudentClassPackages
        .mockResolvedValueOnce([pkg('p1')] as any)
        .mockResolvedValueOnce([pkg('p1', { is_enrolled: true })] as any)
      student.enrollFreeClassPackage.mockResolvedValue({} as any)
      renderWithStore(<CourseList />, { store: signedIn() })
      expect(await screen.findByText('Unlocks your selected subjects for Grade 10 & 11')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Enrol Free' }))
      expect(student.enrollFreeClassPackage).toHaveBeenCalledWith('p1')
      expect(await screen.findByText('Class Access Active — Package p1')).toBeInTheDocument()
    })

    it('shows and dismisses an enrolment error', async () => {
      student.getStudentClassPackages.mockResolvedValue([pkg('p1')] as any)
      student.enrollFreeClassPackage.mockImplementation(() => httpError(400, { detail: 'Wrong grade' }))
      renderWithStore(<CourseList />, { store: signedIn() })
      await userEvent.click(await screen.findByRole('button', { name: 'Enrol Free' }))
      expect(await screen.findByText('Wrong grade')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '✕' }))
      expect(screen.queryByText('Wrong grade')).not.toBeInTheDocument()
    })
  })
})

describe('My courses page', () => {
  const enrolled = (id: string, extra: any = {}) => ({
    enrollment_id: `e${id}`,
    course: { id, title: `Course ${id}`, subject: 'Maths', grade: 11, course_type: 'exam', image_url: null },
    progress_percentage: 0,
    expires_at: null,
    ...extra,
  })

  it('sends visitors to log in', () => {
    nav.pathname = '/student/my-courses'
    renderWithStore(<MyCoursesPage />, { store: makeStore({ auth: { isInitialized: true } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fstudent%2Fmy-courses')
  })

  it('shows the loader while enrollments load', () => {
    student.getMyEnrollments.mockReturnValue(new Promise(() => {}))
    renderWithStore(<MyCoursesPage />, { store: signedIn() })
    expect(screen.getByText('Loading your classroom...')).toBeInTheDocument()
  })

  it('lists enrolled courses with type, progress and a classroom link', async () => {
    student.getMyEnrollments.mockResolvedValue({
      courses: [
        enrolled('1', { progress_percentage: 40 }),
        enrolled('2', { progress_percentage: 100, enrollment_type: 'class_package', course: { id: '2', title: 'Course 2', subject: 'Science', grade: 10, course_type: 'video', image_url: 'https://cdn/x.png' } }),
      ],
      exams: [],
    } as any)
    renderWithStore(<MyCoursesPage />, { store: signedIn() })
    expect(await screen.findByText('Course 1')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('PAPER CLASS')).toBeInTheDocument()
    expect(screen.getByText('VIDEO CLASS')).toBeInTheDocument()
    expect(screen.getByText('Class Access')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Course 2' })).toHaveAttribute('src', 'https://cdn/x.png')
    expect(screen.getAllByRole('link', { name: /OPEN CLASSROOM/ })[0]).toHaveAttribute('href', '/student/courses/1')
  })

  it('filters by course type', async () => {
    student.getMyEnrollments.mockResolvedValue({
      courses: [enrolled('1'), enrolled('2', { course: { id: '2', title: 'Course 2', subject: 'S', grade: 10, course_type: 'video' } })],
      exams: [],
    } as any)
    renderWithStore(<MyCoursesPage />, { store: signedIn() })
    await screen.findByText('Course 1')
    await userEvent.click(screen.getByRole('button', { name: 'Video Classes' }))
    expect(screen.queryByText('Course 1')).not.toBeInTheDocument()
    expect(screen.getByText('Course 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Paper Classes' }))
    expect(screen.getByText('Course 1')).toBeInTheDocument()
    expect(screen.queryByText('Course 2')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'All Courses' }))
    expect(screen.getByText('Course 2')).toBeInTheDocument()
  })

  it('shows expiry badges', async () => {
    const day = 24 * 60 * 60 * 1000
    student.getMyEnrollments.mockResolvedValue({
      courses: [
        enrolled('1', { expires_at: new Date(Date.now() - day).toISOString() }),
        enrolled('2', { expires_at: new Date(Date.now() + 10.5 * day).toISOString() }),
        enrolled('3', { expires_at: new Date(Date.now() + 90.5 * day).toISOString() }),
      ],
      exams: [],
    } as any)
    renderWithStore(<MyCoursesPage />, { store: signedIn() })
    expect(await screen.findByText('Expired')).toBeInTheDocument()
    expect(screen.getByText('10d left').className).toContain('text-orange-600')
    expect(screen.getByText('90d left').className).toContain('text-gray-500')
  })

  it('shows an empty state', async () => {
    student.getMyEnrollments.mockResolvedValue({ courses: [], exams: [] } as any)
    renderWithStore(<MyCoursesPage />, { store: signedIn() })
    expect(await screen.findByText('No courses found')).toBeInTheDocument()
  })

  it('renders nothing while the profile still needs completing', async () => {
    student.getMyEnrollments.mockResolvedValue({ courses: [], exams: [] } as any)
    const { container } = renderWithStore(<MyCoursesPage />, { store: signedIn({ auth: { isAuthenticated: true, isInitialized: true, needsProfileCompletion: true } }) })
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})

describe('Class packages page', () => {
  it('fetches the user when auth is not initialised and renders nothing yet', () => {
    auth.getCurrentUser.mockReturnValue(new Promise(() => {}))
    const { container } = renderWithStore(<StudentClassPackagesPage />)
    expect(auth.getCurrentUser).toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('sends visitors to log in', () => {
    renderWithStore(<StudentClassPackagesPage />, { store: makeStore({ auth: { isInitialized: true } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/login')
  })

  it('lists packages with level badges, descriptions and actions', async () => {
    student.getStudentClassPackages.mockResolvedValue([
      pkg('p1', { grade: 8 }),
      pkg('p2', { grade: 11, price: 1500, stream_name: 'Tamil medium' }),
      pkg('p3', { grade: 13, is_enrolled: true, description: 'Everything for A/L' }),
    ] as any)
    renderWithStore(<StudentClassPackagesPage />, { store: signedIn() })
    expect(await screen.findByText('Package p1')).toBeInTheDocument()
    expect(screen.getByText('Primary')).toBeInTheDocument()
    expect(screen.getByText('O/L')).toBeInTheDocument()
    expect(screen.getByText('A/L')).toBeInTheDocument()
    expect(screen.getByText('Unlocks all your selected subjects for Grade 8')).toBeInTheDocument()
    expect(screen.getByText('Unlocks all your selected subjects for Grade 10 & 11')).toBeInTheDocument()
    expect(screen.getByText('Everything for A/L')).toBeInTheDocument()
    expect(screen.getByText('Tamil medium')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Buy Now' })).toHaveAttribute('href', '/payment?type=class_package&id=p2&name=Package%20p2&amount=1500')
    expect(screen.getByText('Enrolled ✓')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Courses →' })).toHaveAttribute('href', '/student/courses')
    expect(screen.getByText('You have active class enrollments!')).toBeInTheDocument()
  })

  it('enrols in a free package and refreshes', async () => {
    student.getStudentClassPackages
      .mockResolvedValueOnce([pkg('p1')] as any)
      .mockResolvedValueOnce([pkg('p1', { is_enrolled: true })] as any)
    student.enrollFreeClassPackage.mockResolvedValue({} as any)
    renderWithStore(<StudentClassPackagesPage />, { store: signedIn() })
    await userEvent.click(await screen.findByRole('button', { name: 'Enrol Free' }))
    expect(student.enrollFreeClassPackage).toHaveBeenCalledWith('p1')
    expect(await screen.findByText('Enrolled ✓')).toBeInTheDocument()
  })

  it('shows and dismisses errors', async () => {
    student.getStudentClassPackages.mockResolvedValue([pkg('p1')] as any)
    student.enrollFreeClassPackage.mockImplementation(() => httpError(409, { detail: 'Already enrolled' }))
    renderWithStore(<StudentClassPackagesPage />, { store: signedIn() })
    await userEvent.click(await screen.findByRole('button', { name: 'Enrol Free' }))
    expect(await screen.findByText('Already enrolled')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(screen.queryByText('Already enrolled')).not.toBeInTheDocument()
  })

  it('shows a load error and an empty state', async () => {
    student.getStudentClassPackages.mockImplementation(() => httpError(500, { detail: 'Service down' }))
    renderWithStore(<StudentClassPackagesPage />, { store: signedIn() })
    expect(await screen.findByText('Service down')).toBeInTheDocument()
    expect(screen.getByText('No class packages available for your grade yet.')).toBeInTheDocument()
  })
})
