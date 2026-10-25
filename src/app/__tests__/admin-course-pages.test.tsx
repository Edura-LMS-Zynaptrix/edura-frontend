jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())
jest.mock('@/lib/api/auth')
jest.mock('@/lib/api/admin')
jest.mock('@/components/admin/EnrollmentAccessModal', () => ({
  __esModule: true,
  default: ({ type, id, courseId, title, onClose }: any) => (
    <div role="dialog" aria-label="access">
      {`${type}:${id}:${courseId ?? ''}:${title}`}
      <button onClick={onClose}>Close access</button>
    </div>
  ),
}))

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as adminApi from '@/lib/api/admin'
import * as authApi from '@/lib/api/auth'
import AdminCoursesPage from '@/app/admin/courses/page'
import CourseSubCoursesPage from '@/app/admin/courses/[courseId]/sub-courses/page'
import CourseVideoModulesPage from '@/app/admin/courses/[courseId]/video-modules/page'
import { PerformanceAnalysis } from '@/app/admin/courses/PerformanceAnalysis'
import { httpError } from '@/test-utils/api'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const admin = adminApi as jest.Mocked<typeof adminApi>
const auth = authApi as jest.Mocked<typeof authApi>

const asRole = (role: string, extra: any = {}) =>
  makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: 'a1', role } as any }, ...extra })
const asAdmin = (extra: any = {}) => asRole('admin', extra)

const png = (name = 'thumb.png') => new File(['img'], name, { type: 'image/png' })
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement

let confirmSpy: jest.SpyInstance
beforeEach(() => {
  nav.reset()
  jest.resetAllMocks()
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => confirmSpy.mockRestore())

const lesson = (id: string, extra: any = {}) => ({
  id, course_id: 'c1', title: `Lesson ${id}`, description: null, image_url: null, image_public_id: null, is_active: true, order_number: Number(id.replace(/\D/g, '')) || 0, ...extra,
})
const course = (id: string, extra: any = {}) => ({
  id, title: `Course ${id}`, subject: 'Maths', grade: 10, course_type: 'video', image_url: null, image_public_id: null, price: 0, description: null, is_active: false, stream_ids: [], sub_courses: [], ...extra,
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Course management', () => {
  const courses = [
    course('c1', { title: 'Combined Maths', course_type: 'exam', price: 1500, is_active: true, description: 'Past papers', image_url: 'https://img/c1.png', image_public_id: 'pid-c1', grade: 12, stream_ids: ['st1'], sub_courses: [lesson('l1'), lesson('l2')] }),
    course('c2', { title: 'Science Videos' }),
  ]
  const streams = [
    { id: 'st1', name: 'Physical Science', description: null, subjects: [], is_active: true },
    { id: 'st2', name: 'Arts', description: null, subjects: [], is_active: false },
  ]
  const card = (title: string) => within(screen.getByRole('heading', { name: title }).closest('.overflow-hidden') as HTMLElement)

  const renderPage = async () => {
    const view = renderWithStore(<AdminCoursesPage />, { store: asAdmin() })
    await screen.findByText('Combined Maths')
    return view
  }

  beforeEach(() => {
    admin.getCourses.mockResolvedValue(courses as any)
    admin.getStreams.mockResolvedValue(streams as any)
  })

  describe('access', () => {
    it('sends visitors to log in, keeping the query string', () => {
      nav.pathname = '/admin/courses'
      nav.setSearch({ q: 'maths' })
      renderWithStore(<AdminCoursesPage />, { store: makeStore({ auth: { isInitialized: true } }) })
      expect(nav.router.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fadmin%2Fcourses%3Fq%3Dmaths')
    })

    it('fetches the user when signed in without one', () => {
      auth.getCurrentUser.mockReturnValue(new Promise(() => {}))
      renderWithStore(<AdminCoursesPage />, { store: makeStore({ auth: { isAuthenticated: true, isInitialized: true } }) })
      expect(auth.getCurrentUser).toHaveBeenCalled()
      expect(screen.getByText('Loading admin panel...')).toBeInTheDocument()
    })

    it('sends non-admins home without loading courses', () => {
      renderWithStore(<AdminCoursesPage />, { store: asRole('teacher') })
      expect(nav.router.push).toHaveBeenCalledWith('/')
      expect(admin.getCourses).not.toHaveBeenCalled()
    })
  })

  describe('list', () => {
    it('loads courses and streams', async () => {
      admin.getCourses.mockReturnValue(new Promise(() => {}))
      admin.getStreams.mockReturnValue(new Promise(() => {}))
      renderWithStore(<AdminCoursesPage />, { store: asAdmin() })
      expect(screen.getByText('Loading data...')).toBeInTheDocument()
      expect(admin.getStreams).toHaveBeenCalled()
      expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/admin/dashboard')
    })

    it('shows each course card', async () => {
      await renderPage()
      const exam = card('Combined Maths')
      expect(exam.getByText('Published')).toBeInTheDocument()
      expect(exam.getByText('Exam Course')).toBeInTheDocument()
      expect(exam.getByText('Past papers')).toBeInTheDocument()
      expect(exam.getByText('LKR 1,500')).toBeInTheDocument()
      expect(exam.getByRole('img', { name: 'Combined Maths' })).toHaveAttribute('src', 'https://img/c1.png')
      expect(exam.getByRole('link', { name: 'Manage Lessons (2)' })).toHaveAttribute('href', '/admin/courses/c1/sub-courses')
      expect(exam.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument()

      const video = card('Science Videos')
      expect(video.getByText('Draft')).toBeInTheDocument()
      expect(video.getByText('Video Course')).toBeInTheDocument()
      expect(video.getByText('Free')).toBeInTheDocument()
      expect(video.getByText('📘')).toBeInTheDocument()
      expect(video.getByRole('link', { name: 'Manage Lessons (0)' })).toHaveAttribute('href', '/admin/courses/c2/video-modules')
      expect(video.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    })

    it('filters by title', async () => {
      await renderPage()
      await userEvent.type(screen.getByPlaceholderText('Search by title...'), '  SCIENCE ')
      expect(screen.queryByText('Combined Maths')).not.toBeInTheDocument()
      expect(screen.getByText('Science Videos')).toBeInTheDocument()
      await userEvent.type(screen.getByPlaceholderText('Search by title...'), 'zzz')
      expect(screen.getByText('No courses match your search')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Create your first course' })).not.toBeInTheDocument()
    })

    it('offers to create the first course when there are none', async () => {
      admin.getCourses.mockResolvedValue([])
      renderWithStore(<AdminCoursesPage />, { store: asAdmin() })
      await userEvent.click(await screen.findByRole('button', { name: 'Create your first course' }))
      expect(screen.getByRole('heading', { name: 'Create Course' })).toBeInTheDocument()
    })

    it('shows a failed load', async () => {
      admin.getCourses.mockImplementation(() => httpError(500, { detail: 'Course service down' }))
      renderWithStore(<AdminCoursesPage />, { store: asAdmin() })
      expect(await screen.findByText('Course service down')).toBeInTheDocument()
    })

    it('opens and closes the access manager', async () => {
      await renderPage()
      await userEvent.click(card('Combined Maths').getByRole('button', { name: 'Manage Access' }))
      expect(screen.getByRole('dialog', { name: 'access' })).toHaveTextContent('course:c1::Combined Maths')
      await userEvent.click(screen.getByRole('button', { name: 'Close access' }))
      expect(screen.queryByRole('dialog', { name: 'access' })).not.toBeInTheDocument()
    })
  })

  describe('create', () => {
    const openCreate = async () => {
      await renderPage()
      await userEvent.click(screen.getByRole('button', { name: '+ Create Course' }))
    }

    it('explains each course type and shows active A/L streams only for grades 12–13', async () => {
      await openCreate()
      expect(screen.getByText(/Video course: add lessons/)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('radio', { name: 'Exam Course' }))
      expect(screen.getByText(/Exam course: add lessons/)).toBeInTheDocument()

      expect(screen.queryByText('A/L Streams')).not.toBeInTheDocument()
      await userEvent.selectOptions(screen.getByRole('combobox'), '13')
      expect(screen.getByRole('checkbox', { name: 'Physical Science' })).toBeInTheDocument()
      expect(screen.queryByRole('checkbox', { name: 'Arts' })).not.toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Grade 13 (A/L)' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Grade 10 (O/L)' })).toBeInTheDocument()
    })

    it('says when no streams exist', async () => {
      admin.getStreams.mockResolvedValue([])
      await openCreate()
      await userEvent.selectOptions(screen.getByRole('combobox'), '12')
      expect(screen.getByText('No streams configured yet.')).toBeInTheDocument()
    })

    it('creates an A/L exam course with the chosen streams', async () => {
      admin.createCourse.mockResolvedValue(course('c3', { title: 'Physics', price: 2000 }) as any)
      await openCreate()
      await userEvent.type(screen.getByPlaceholderText('Course title'), '  Physics  ')
      await userEvent.type(screen.getByPlaceholderText('Description (optional)'), ' Theory ')
      await userEvent.clear(screen.getByRole('spinbutton'))
      await userEvent.type(screen.getByRole('spinbutton'), '2000')
      await userEvent.click(screen.getByRole('radio', { name: 'Exam Course' }))
      await userEvent.selectOptions(screen.getByRole('combobox'), '12')
      await userEvent.click(screen.getByRole('checkbox', { name: 'Physical Science' }))
      await userEvent.click(screen.getByRole('button', { name: 'Create Course' }))

      expect(admin.createCourse).toHaveBeenCalledWith({
        title: 'Physics', subject: '', grade: 12, course_type: 'exam', price: 2000, description: 'Theory',
        image_url: null, image_public_id: null, stream_ids: ['st1'],
      })
      expect(await screen.findByRole('heading', { name: 'Physics' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Create Course' })).not.toBeInTheDocument()
      expect(admin.uploadImage).not.toHaveBeenCalled()
    })

    it('drops streams and grade for an ungated course, and unticks a stream', async () => {
      admin.createCourse.mockResolvedValue(course('c3') as any)
      await openCreate()
      await userEvent.type(screen.getByPlaceholderText('Course title'), 'Any')
      await userEvent.clear(screen.getByRole('spinbutton'))
      await userEvent.selectOptions(screen.getByRole('combobox'), '12')
      const stream = screen.getByRole('checkbox', { name: 'Physical Science' })
      await userEvent.click(stream)
      await userEvent.click(stream)
      expect(stream).not.toBeChecked()
      await userEvent.selectOptions(screen.getByRole('combobox'), '')
      fireEvent.submit(screen.getByPlaceholderText('Course title').closest('form')!)
      await waitFor(() => expect(admin.createCourse).toHaveBeenCalledWith(expect.objectContaining({ grade: 0, price: 0, description: null, stream_ids: undefined })))
    })

    it('uploads a thumbnail first', async () => {
      admin.uploadImage.mockResolvedValue({ image_url: 'https://img/new.png', image_public_id: 'pid-new' } as any)
      admin.createCourse.mockResolvedValue(course('c3') as any)
      await openCreate()
      await userEvent.type(screen.getByPlaceholderText('Course title'), 'Physics')
      await userEvent.upload(fileInput(), png())
      expect(screen.getByText('Selected: thumb.png')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Create Course' }))
      expect(admin.uploadImage).toHaveBeenCalledWith(expect.any(File), 'courses')
      await waitFor(() => expect(admin.createCourse).toHaveBeenCalledWith(expect.objectContaining({ image_url: 'https://img/new.png', image_public_id: 'pid-new' })))
    })

    it('stops when the thumbnail upload fails', async () => {
      admin.uploadImage.mockImplementation(() => httpError(413, { detail: 'File too large' }))
      await openCreate()
      await userEvent.type(screen.getByPlaceholderText('Course title'), 'Physics')
      await userEvent.upload(fileInput(), png())
      await userEvent.click(screen.getByRole('button', { name: 'Create Course' }))
      expect(await screen.findByText('File too large')).toBeInTheDocument()
      expect(admin.createCourse).not.toHaveBeenCalled()
    })

    it('validates the title and price', async () => {
      await openCreate()
      const form = screen.getByPlaceholderText('Course title').closest('form')!
      await userEvent.type(screen.getByPlaceholderText('Course title'), '   ')
      fireEvent.submit(form)
      expect(await screen.findByText('Please enter a course title')).toBeInTheDocument()
      await userEvent.type(screen.getByPlaceholderText('Course title'), 'Physics')
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-5' } })
      fireEvent.submit(form)
      expect(await screen.findByText('Please enter a valid price')).toBeInTheDocument()
      expect(admin.createCourse).not.toHaveBeenCalled()
    })

    it('shows a failed create inside the modal', async () => {
      admin.createCourse.mockImplementation(() => httpError(409, { detail: 'Title already used' }))
      await openCreate()
      await userEvent.type(screen.getByPlaceholderText('Course title'), 'Physics')
      await userEvent.click(screen.getByRole('button', { name: 'Create Course' }))
      expect(await screen.findByText('Title already used')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Create Course' })).toBeInTheDocument()
    })

    it('closes with Cancel or ✕', async () => {
      await openCreate()
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('heading', { name: 'Create Course' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '+ Create Course' }))
      await userEvent.click(screen.getByRole('button', { name: '✕' }))
      expect(screen.queryByRole('heading', { name: 'Create Course' })).not.toBeInTheDocument()
    })
  })

  describe('edit', () => {
    const openEdit = async (title = 'Combined Maths') => {
      await renderPage()
      await userEvent.click(card(title).getByRole('button', { name: 'Edit' }))
    }

    it('prefills the form and locks the type once lessons exist', async () => {
      await openEdit()
      expect(screen.getByRole('heading', { name: 'Edit Course' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Course title')).toHaveValue('Combined Maths')
      expect(screen.getByPlaceholderText('Description (optional)')).toHaveValue('Past papers')
      expect(screen.getByRole('spinbutton')).toHaveValue(1500)
      expect(screen.getByRole('combobox')).toHaveValue('12')
      expect(screen.getByRole('checkbox', { name: 'Physical Science' })).toBeChecked()
      expect(screen.getByRole('img', { name: 'Current course' })).toHaveAttribute('src', 'https://img/c1.png')
      expect(screen.getByRole('radio', { name: 'Exam Course' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'Video Course' })).toBeDisabled()
    })

    it('lets a course without lessons change type', async () => {
      admin.updateCourse.mockResolvedValue(course('c2', { title: 'Science Videos', course_type: 'exam' }) as any)
      await openEdit('Science Videos')
      expect(screen.getByRole('combobox')).toHaveValue('10')
      const exam = screen.getByRole('radio', { name: 'Exam Course' })
      expect(exam).toBeEnabled()
      await userEvent.click(exam)
      expect(screen.getByText(/Exam course: add lessons/)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('radio', { name: 'Video Course' }))
      await userEvent.click(exam)
      await userEvent.click(screen.getByRole('button', { name: 'Update Course' }))
      expect(admin.updateCourse).toHaveBeenCalledWith('c2', {
        title: 'Science Videos', price: 0, course_type: 'exam', grade: 10, description: null,
        image_url: null, image_public_id: null, stream_ids: [],
      })
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Course' })).not.toBeInTheDocument())
    })

    it('keeps the current image and clears streams when the grade leaves A/L', async () => {
      admin.updateCourse.mockResolvedValue(courses[0] as any)
      await openEdit()
      await userEvent.selectOptions(screen.getByRole('combobox'), '')
      await userEvent.click(screen.getByRole('button', { name: 'Update Course' }))
      expect(admin.updateCourse).toHaveBeenCalledWith('c1', expect.objectContaining({
        grade: undefined, stream_ids: [], image_url: 'https://img/c1.png', image_public_id: 'pid-c1',
      }))
      expect(admin.uploadImage).not.toHaveBeenCalled()
    })

    it('toggles streams while editing', async () => {
      admin.updateCourse.mockResolvedValue(courses[0] as any)
      await openEdit()
      await userEvent.click(screen.getByRole('checkbox', { name: 'Physical Science' }))
      await userEvent.click(screen.getByRole('button', { name: 'Update Course' }))
      expect(admin.updateCourse).toHaveBeenCalledWith('c1', expect.objectContaining({ grade: 12, stream_ids: [] }))
    })

    it('replaces the image with a new upload', async () => {
      admin.uploadImage.mockResolvedValue({ image_url: 'https://img/v2.png', image_public_id: 'pid-v2' } as any)
      admin.updateCourse.mockResolvedValue(courses[0] as any)
      await openEdit()
      await userEvent.upload(fileInput(), png('v2.png'))
      expect(screen.getByText('Selected: v2.png (will replace current image)')).toBeInTheDocument()
      expect(screen.queryByRole('img', { name: 'Current course' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Update Course' }))
      await waitFor(() => expect(admin.updateCourse).toHaveBeenCalledWith('c1', expect.objectContaining({ image_url: 'https://img/v2.png', image_public_id: 'pid-v2' })))
    })

    it('stops when the new image fails to upload', async () => {
      admin.uploadImage.mockImplementation(() => httpError(400, { detail: 'Bad image' }))
      await openEdit()
      await userEvent.upload(fileInput(), png())
      await userEvent.click(screen.getByRole('button', { name: 'Update Course' }))
      expect(await screen.findByText('Bad image')).toBeInTheDocument()
      expect(admin.updateCourse).not.toHaveBeenCalled()
    })

    it('validates and reports a failed save', async () => {
      admin.updateCourse.mockImplementation(() => httpError(400, { detail: 'Price too high' }))
      await openEdit()
      const title = screen.getByPlaceholderText('Course title')
      await userEvent.clear(title)
      await userEvent.type(title, ' ')
      fireEvent.submit(title.closest('form')!)
      expect(await screen.findByText('Please enter a course title')).toBeInTheDocument()
      await userEvent.type(title, 'Maths')
      await userEvent.click(screen.getByRole('button', { name: 'Update Course' }))
      expect(await screen.findByText('Price too high')).toBeInTheDocument()
    })

    it('closes with Cancel or ✕', async () => {
      await openEdit()
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('heading', { name: 'Edit Course' })).not.toBeInTheDocument()
      await userEvent.click(card('Combined Maths').getByRole('button', { name: 'Edit' }))
      await userEvent.click(screen.getByRole('button', { name: '✕' }))
      expect(screen.queryByRole('heading', { name: 'Edit Course' })).not.toBeInTheDocument()
    })
  })

  describe('publish and delete', () => {
    it('unpublishes a published course and publishes a draft', async () => {
      admin.updateCourse
        .mockResolvedValueOnce({ ...courses[0], is_active: false } as any)
        .mockResolvedValueOnce({ ...courses[1], is_active: true } as any)
      await renderPage()
      await userEvent.click(card('Combined Maths').getByRole('button', { name: 'Unpublish' }))
      expect(admin.updateCourse).toHaveBeenCalledWith('c1', { status: 'DRAFT' })
      expect(await card('Combined Maths').findByText('Draft')).toBeInTheDocument()
      await userEvent.click(card('Science Videos').getByRole('button', { name: 'Publish' }))
      expect(admin.updateCourse).toHaveBeenLastCalledWith('c2', { status: 'PUBLISHED' })
    })

    it('shows a failed publish', async () => {
      admin.updateCourse.mockImplementation(() => httpError(409, { detail: 'Course has no lessons' }))
      await renderPage()
      await userEvent.click(card('Science Videos').getByRole('button', { name: 'Publish' }))
      expect(await screen.findByText('Course has no lessons')).toBeInTheDocument()
    })

    it('deletes only after confirming', async () => {
      admin.deleteCourse.mockResolvedValue(undefined as any)
      confirmSpy.mockReturnValueOnce(false)
      await renderPage()
      await userEvent.click(card('Science Videos').getByRole('button', { name: 'Delete' }))
      expect(confirmSpy).toHaveBeenCalledWith('Delete course "Science Videos"? All its modules and lessons will also be deleted.')
      expect(admin.deleteCourse).not.toHaveBeenCalled()
      await userEvent.click(card('Science Videos').getByRole('button', { name: 'Delete' }))
      expect(admin.deleteCourse).toHaveBeenCalledWith('c2')
      await waitFor(() => expect(screen.queryByText('Science Videos')).not.toBeInTheDocument())
    })

    it('shows a failed delete', async () => {
      admin.deleteCourse.mockImplementation(() => httpError(409, { detail: 'Course has enrollments' }))
      await renderPage()
      await userEvent.click(card('Science Videos').getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText('Course has enrollments')).toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Exam course lessons', () => {
  const lessons = [
    lesson('l2', { title: 'Algebra', description: 'Equations', image_url: 'https://img/l2.png', image_public_id: 'pid-l2', order_number: 2 }),
    lesson('l1', { title: 'Geometry', is_active: false, order_number: 1 }),
  ]
  const examCourse = course('c1', { title: 'Combined Maths', course_type: 'exam', price: 1500, sub_courses: lessons })
  const withCourse = (role = 'admin') => asRole(role, { courses: { courses: [examCourse] } })
  const card = (title: string) => within(screen.getByRole('heading', { name: title }).closest('.overflow-hidden') as HTMLElement)

  const renderPage = (store = withCourse()) => renderWithStore(<CourseSubCoursesPage />, { store })

  beforeEach(() => {
    nav.params = { courseId: 'c1' }
  })

  it('sends visitors to log in', () => {
    nav.pathname = '/admin/courses/c1/sub-courses'
    renderPage(makeStore({ auth: { isInitialized: true } }))
    expect(nav.router.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fadmin%2Fcourses%2Fc1%2Fsub-courses')
  })

  it('fetches the user when signed in without one', () => {
    auth.getCurrentUser.mockReturnValue(new Promise(() => {}))
    renderPage(makeStore({ auth: { isAuthenticated: true, isInitialized: true } }))
    expect(auth.getCurrentUser).toHaveBeenCalled()
    expect(screen.getByText('Loading admin panel...')).toBeInTheDocument()
  })

  it('sends students home but lets super admins in', () => {
    renderPage(withCourse('student'))
    expect(nav.router.push).toHaveBeenCalledWith('/')
    nav.reset()
    nav.params = { courseId: 'c1' }
    renderPage(withCourse('super_admin'))
    expect(nav.router.push).not.toHaveBeenCalled()
  })

  it('loads courses when the store is empty', async () => {
    admin.getCourses.mockResolvedValue([examCourse] as any)
    renderPage(asAdmin())
    expect(screen.getByRole('heading', { name: 'Manage Lessons' })).toBeInTheDocument()
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Manage Lessons • Combined Maths' })).toBeInTheDocument()
    expect(admin.getCourses).toHaveBeenCalledTimes(1)
  })

  it('shows the course and its lessons', () => {
    renderPage()
    expect(admin.getCourses).not.toHaveBeenCalled()
    expect(screen.getByText('Grade 10 • Maths • LKR 1,500')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Courses' })).toHaveAttribute('href', '/admin/courses')
    const algebra = card('Algebra')
    expect(algebra.getByText('Order: 2')).toBeInTheDocument()
    expect(algebra.getByText('Status: Active')).toBeInTheDocument()
    expect(algebra.getByText('Equations')).toBeInTheDocument()
    expect(algebra.getByRole('img', { name: 'Algebra' })).toHaveAttribute('src', 'https://img/l2.png')
    expect(algebra.getByRole('link', { name: 'Manage Exams' })).toHaveAttribute('href', '/admin/courses/c1/sub-courses/l2/exams')
    expect(card('Geometry').getByText('Status: Inactive')).toBeInTheDocument()
  })

  it('shows a free course with no lessons', async () => {
    renderPage(asAdmin({ courses: { courses: [course('c1', { title: 'Free Maths', course_type: 'exam' })] } }))
    expect(screen.getByText('Grade 10 • Maths • Free')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create your first Lesson' }))
    expect(screen.getByRole('heading', { name: 'Create Lesson' })).toBeInTheDocument()
  })

  it('opens and closes the lesson access manager', async () => {
    renderPage()
    await userEvent.click(card('Algebra').getByRole('button', { name: 'Manage Access' }))
    expect(screen.getByRole('dialog', { name: 'access' })).toHaveTextContent('sub_course:l2:c1:Algebra')
    await userEvent.click(screen.getByRole('button', { name: 'Close access' }))
    expect(screen.queryByRole('dialog', { name: 'access' })).not.toBeInTheDocument()
  })

  describe('create', () => {
    const openCreate = async () => {
      renderPage()
      await userEvent.click(screen.getByRole('button', { name: '+ Create Lesson' }))
    }
    const titleBox = () => screen.getByPlaceholderText('Lesson title (e.g. Lesson 01 - Algebra)')

    it('creates a lesson with an image', async () => {
      admin.uploadImage.mockResolvedValue({ image_url: 'https://img/l3.png', image_public_id: 'pid-l3' } as any)
      admin.createSubCourse.mockResolvedValue(lesson('l3', { title: 'Calculus' }) as any)
      await openCreate()
      await userEvent.type(titleBox(), ' Calculus ')
      await userEvent.type(screen.getByPlaceholderText('Description (optional)'), ' Limits ')
      await userEvent.clear(screen.getByRole('spinbutton'))
      await userEvent.type(screen.getByRole('spinbutton'), '3')
      await userEvent.upload(fileInput(), png())
      await userEvent.click(screen.getByRole('checkbox', { name: 'Active (Visible to students)' }))
      await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }))

      expect(admin.uploadImage).toHaveBeenCalledWith(expect.any(File), 'courses')
      await waitFor(() => expect(admin.createSubCourse).toHaveBeenCalledWith({
        course_id: 'c1', title: 'Calculus', description: 'Limits', order_number: 3, is_active: false,
        image_url: 'https://img/l3.png', image_public_id: 'pid-l3',
      }))
      expect(await screen.findByRole('heading', { name: 'Calculus' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Create Lesson' })).not.toBeInTheDocument()
    })

    it('creates a lesson without an image', async () => {
      admin.createSubCourse.mockResolvedValue(lesson('l3') as any)
      await openCreate()
      await userEvent.type(titleBox(), 'Calculus')
      await userEvent.clear(screen.getByRole('spinbutton'))
      await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }))
      expect(admin.createSubCourse).toHaveBeenCalledWith(expect.objectContaining({ description: null, order_number: 0, is_active: true, image_url: null }))
      expect(admin.uploadImage).not.toHaveBeenCalled()
    })

    it('needs a title', async () => {
      await openCreate()
      await userEvent.type(titleBox(), '   ')
      fireEvent.submit(titleBox().closest('form')!)
      expect(await screen.findByText('Please enter a title')).toBeInTheDocument()
      expect(admin.createSubCourse).not.toHaveBeenCalled()
    })

    it('stops when the image upload fails', async () => {
      admin.uploadImage.mockImplementation(() => httpError(413, { detail: 'Image too big' }))
      await openCreate()
      await userEvent.type(titleBox(), 'Calculus')
      await userEvent.upload(fileInput(), png())
      await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }))
      expect(await screen.findByText('Image too big')).toBeInTheDocument()
      expect(admin.createSubCourse).not.toHaveBeenCalled()
    })

    it('needs a course id', async () => {
      nav.params = {}
      renderPage()
      await userEvent.click(screen.getByRole('button', { name: '+ Create Lesson' }))
      await userEvent.type(titleBox(), 'Calculus')
      await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }))
      expect(await screen.findByText('Course ID is missing')).toBeInTheDocument()
    })

    it('shows a failed create and closes', async () => {
      admin.createSubCourse.mockImplementation(() => httpError(409, { detail: 'Duplicate lesson' }))
      await openCreate()
      await userEvent.type(titleBox(), 'Calculus')
      await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }))
      expect(await screen.findByText('Duplicate lesson')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '✕' }))
      expect(screen.queryByRole('heading', { name: 'Create Lesson' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '+ Create Lesson' }))
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('heading', { name: 'Create Lesson' })).not.toBeInTheDocument()
    })
  })

  describe('edit', () => {
    const openEdit = async (title = 'Algebra') => {
      renderPage()
      await userEvent.click(card(title).getByRole('button', { name: 'Edit' }))
    }
    const save = () => userEvent.click(screen.getByRole('button', { name: 'Update Lesson' }))

    it('prefills the form and keeps the current image', async () => {
      admin.updateSubCourse.mockResolvedValue(lessons[0] as any)
      await openEdit()
      expect(screen.getByDisplayValue('Algebra')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Equations')).toBeInTheDocument()
      expect(screen.getByRole('spinbutton')).toHaveValue(2)
      expect(screen.getByRole('img', { name: 'Current' })).toHaveAttribute('src', 'https://img/l2.png')
      await save()
      expect(admin.updateSubCourse).toHaveBeenCalledWith('c1', 'l2', {
        title: 'Algebra', description: 'Equations', order_number: 2, is_active: true,
        image_url: 'https://img/l2.png', image_public_id: 'pid-l2',
      })
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Lesson' })).not.toBeInTheDocument())
    })

    it('removes the image, with undo', async () => {
      admin.updateSubCourse.mockResolvedValue(lessons[0] as any)
      admin.deleteImage.mockResolvedValue({} as any)
      await openEdit()
      await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
      expect(screen.getByText('Image will be removed')).toBeInTheDocument()
      expect(fileInput()).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(screen.getByRole('img', { name: 'Current' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
      await save()
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-l2')
      await waitFor(() => expect(admin.updateSubCourse).toHaveBeenCalledWith('c1', 'l2', expect.objectContaining({ image_url: null, image_public_id: null })))
    })

    it('replaces the image and deletes the old one', async () => {
      admin.uploadImage.mockResolvedValue({ image_url: 'https://img/new.png', image_public_id: 'pid-new' } as any)
      admin.updateSubCourse.mockResolvedValue(lessons[0] as any)
      await openEdit()
      await userEvent.upload(fileInput(), png())
      await save()
      await waitFor(() => expect(admin.updateSubCourse).toHaveBeenCalledWith('c1', 'l2', expect.objectContaining({ image_url: 'https://img/new.png', image_public_id: 'pid-new' })))
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-l2')
    })

    it('saves a lesson that never had an image', async () => {
      admin.updateSubCourse.mockResolvedValue(lessons[1] as any)
      await openEdit('Geometry')
      expect(screen.getByRole('checkbox', { name: 'Active (Visible to students)' })).not.toBeChecked()
      await userEvent.click(screen.getByRole('checkbox', { name: 'Active (Visible to students)' }))
      await save()
      expect(admin.updateSubCourse).toHaveBeenCalledWith('c1', 'l1', expect.objectContaining({ is_active: true, image_url: null, image_public_id: null, description: null }))
    })

    it('stops when the new image fails to upload', async () => {
      admin.uploadImage.mockImplementation(() => httpError(400, { detail: 'Bad image' }))
      await openEdit()
      await userEvent.upload(fileInput(), png())
      await save()
      expect(await screen.findByText('Bad image')).toBeInTheDocument()
      expect(admin.updateSubCourse).not.toHaveBeenCalled()
    })

    it('validates and reports a failed save', async () => {
      admin.updateSubCourse.mockImplementation(() => httpError(400, { detail: 'Order taken' }))
      await openEdit()
      const title = screen.getByDisplayValue('Algebra')
      await userEvent.clear(title)
      await userEvent.type(title, ' ')
      fireEvent.submit(title.closest('form')!)
      expect(await screen.findByText('Please enter a title')).toBeInTheDocument()
      await userEvent.type(title, 'Algebra II')
      await save()
      expect(await screen.findByText('Order taken')).toBeInTheDocument()
    })

    it('closes with Cancel or ✕', async () => {
      await openEdit()
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('heading', { name: 'Edit Lesson' })).not.toBeInTheDocument()
      await userEvent.click(card('Algebra').getByRole('button', { name: 'Edit' }))
      await userEvent.click(screen.getByRole('button', { name: '✕' }))
      expect(screen.queryByRole('heading', { name: 'Edit Lesson' })).not.toBeInTheDocument()
    })
  })

  describe('delete', () => {
    it('deletes the lesson and its image after confirming', async () => {
      admin.deleteSubCourse.mockResolvedValue(undefined as any)
      admin.deleteImage.mockResolvedValue({} as any)
      confirmSpy.mockReturnValueOnce(false)
      renderPage()
      await userEvent.click(card('Algebra').getByRole('button', { name: 'Delete' }))
      expect(confirmSpy).toHaveBeenCalledWith('Delete lesson "Algebra"? All exams inside will also be deleted.')
      expect(admin.deleteSubCourse).not.toHaveBeenCalled()
      await userEvent.click(card('Algebra').getByRole('button', { name: 'Delete' }))
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-l2')
      await waitFor(() => expect(admin.deleteSubCourse).toHaveBeenCalledWith('c1', 'l2'))
      await waitFor(() => expect(screen.queryByText('Algebra')).not.toBeInTheDocument())
    })

    it('skips the image for a lesson without one and shows failures', async () => {
      admin.deleteSubCourse.mockImplementation(() => httpError(409, { detail: 'Lesson has exams' }))
      renderPage()
      await userEvent.click(card('Geometry').getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText('Lesson has exams')).toBeInTheDocument()
      expect(admin.deleteImage).not.toHaveBeenCalled()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Video course lessons', () => {
  const modules = [
    { id: 'm2', title: 'Waves', description: 'Sound and light', order_number: 2, video_count: 4, is_active: true, image_url: 'https://img/m2.png', image_public_id: 'pid-m2' },
    { id: 'm1', title: 'Motion', description: null, order_number: 1, is_active: false, image_url: null, image_public_id: null },
  ]
  const videoCourse = course('c1', { title: 'Physics Videos' })
  const withCourse = (role = 'admin') => asRole(role, { courses: { courses: [videoCourse] } })
  const card = (title: string) => within(screen.getByRole('heading', { name: title }).closest('.overflow-hidden') as HTMLElement)

  const renderPage = async (store = withCourse()) => {
    const view = renderWithStore(<CourseVideoModulesPage />, { store })
    await screen.findByText('Waves')
    return view
  }

  beforeEach(() => {
    nav.params = { courseId: 'c1' }
    admin.getModulesForCourse.mockResolvedValue(modules.map((m) => ({ ...m })))
  })

  describe('access', () => {
    // The lesson list is requested before the auth checks run; hold it so it
    // can't resolve after these synchronous tests finish.
    beforeEach(() => {
      admin.getModulesForCourse.mockReturnValue(new Promise(() => {}))
    })

    it('sends visitors to log in', () => {
      nav.pathname = '/admin/courses/c1/video-modules'
      renderWithStore(<CourseVideoModulesPage />, { store: makeStore({ auth: { isInitialized: true } }) })
      expect(nav.router.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fadmin%2Fcourses%2Fc1%2Fvideo-modules')
    })

    it('fetches the user when signed in without one', () => {
      auth.getCurrentUser.mockReturnValue(new Promise(() => {}))
      renderWithStore(<CourseVideoModulesPage />, { store: makeStore({ auth: { isAuthenticated: true, isInitialized: true } }) })
      expect(auth.getCurrentUser).toHaveBeenCalled()
      expect(screen.getByText('Loading admin panel...')).toBeInTheDocument()
    })

    it('sends students home', () => {
      renderWithStore(<CourseVideoModulesPage />, { store: withCourse('student') })
      expect(nav.router.push).toHaveBeenCalledWith('/')
    })
  })

  it('loads courses when the store is empty', async () => {
    admin.getCourses.mockResolvedValue([videoCourse] as any)
    renderWithStore(<CourseVideoModulesPage />, { store: asAdmin() })
    expect(await screen.findByRole('heading', { name: 'Manage Lessons • Physics Videos' })).toBeInTheDocument()
    expect(screen.getByText('Grade 10 • Maths • Video Course')).toBeInTheDocument()
  })

  it('lists lessons in order', async () => {
    await renderPage()
    expect(admin.getModulesForCourse).toHaveBeenCalledWith('c1')
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Motion', 'Waves'])
    const waves = card('Waves')
    expect(waves.getByText('Videos: 4')).toBeInTheDocument()
    expect(waves.getByText('Active')).toBeInTheDocument()
    expect(waves.getByText('Sound and light')).toBeInTheDocument()
    expect(waves.getByRole('img', { name: 'Waves' })).toBeInTheDocument()
    expect(waves.getByRole('link', { name: 'Manage Videos & Materials' })).toHaveAttribute('href', '/admin/courses/c1/video-modules/m2/videos')
    expect(card('Motion').getByText('Videos: 0')).toBeInTheDocument()
    expect(card('Motion').getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Courses' })).toHaveAttribute('href', '/admin/courses')
  })

  it('shows an empty state when lessons fail to load', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    admin.getModulesForCourse.mockImplementation(() => httpError(500))
    renderWithStore(<CourseVideoModulesPage />, { store: withCourse() })
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to fetch modules:', expect.any(Error)))
    expect(screen.getByText('No lessons yet in this course')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create your first Lesson' }))
    expect(screen.getByRole('heading', { name: 'Create Lesson' })).toBeInTheDocument()
    errorSpy.mockRestore()
  })

  it('opens and closes the lesson access manager', async () => {
    await renderPage()
    await userEvent.click(card('Waves').getByRole('button', { name: 'Manage Access' }))
    expect(screen.getByRole('dialog', { name: 'access' })).toHaveTextContent('module:m2:c1:Waves')
    await userEvent.click(screen.getByRole('button', { name: 'Close access' }))
    expect(screen.queryByRole('dialog', { name: 'access' })).not.toBeInTheDocument()
  })

  describe('create', () => {
    const openCreate = async () => {
      await renderPage()
      await userEvent.click(screen.getByRole('button', { name: '+ Create Lesson' }))
    }
    const titleBox = () => screen.getByPlaceholderText('e.g. Unit 01 - Introduction')

    it('creates a lesson with an image and reloads', async () => {
      admin.uploadImage.mockResolvedValue({ image_url: 'https://img/m3.png', image_public_id: 'pid-m3' } as any)
      admin.createModule.mockResolvedValue({ id: 'm3' } as any)
      await openCreate()
      await userEvent.type(titleBox(), ' Optics ')
      await userEvent.type(screen.getByPlaceholderText('What will students learn?'), ' Lenses ')
      await userEvent.clear(screen.getByRole('spinbutton'))
      await userEvent.type(screen.getByRole('spinbutton'), '3')
      await userEvent.upload(fileInput(), png())
      await userEvent.click(screen.getByRole('checkbox', { name: 'Lesson is active and visible' }))
      await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }))

      await waitFor(() => expect(admin.createModule).toHaveBeenCalledWith({
        course_id: 'c1', title: 'Optics', description: 'Lenses', order_number: 3, is_active: false,
        image_url: 'https://img/m3.png', image_public_id: 'pid-m3',
      }))
      await waitFor(() => expect(admin.getModulesForCourse).toHaveBeenCalledTimes(2))
      expect(screen.queryByRole('heading', { name: 'Create Lesson' })).not.toBeInTheDocument()
    })

    it('creates a lesson without an image', async () => {
      admin.createModule.mockResolvedValue({ id: 'm3' } as any)
      await openCreate()
      await userEvent.type(titleBox(), 'Optics')
      await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }))
      expect(admin.createModule).toHaveBeenCalledWith(expect.objectContaining({ description: null, order_number: 0, is_active: true, image_url: null }))
    })

    it('needs a title and a course id', async () => {
      await openCreate()
      await userEvent.type(titleBox(), '  ')
      fireEvent.submit(titleBox().closest('form')!)
      expect(await screen.findByText('Please enter a title')).toBeInTheDocument()
    })

    it('reports a missing course id', async () => {
      nav.params = {}
      renderWithStore(<CourseVideoModulesPage />, { store: withCourse() })
      await userEvent.click(screen.getByRole('button', { name: '+ Create Lesson' }))
      await userEvent.type(titleBox(), 'Optics')
      await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }))
      expect(await screen.findByText('Course ID is missing')).toBeInTheDocument()
      expect(admin.getModulesForCourse).not.toHaveBeenCalled()
    })

    it('stops when the image upload fails', async () => {
      admin.uploadImage.mockImplementation(() => httpError(413, { detail: 'Image too big' }))
      await openCreate()
      await userEvent.type(titleBox(), 'Optics')
      await userEvent.upload(fileInput(), png())
      await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }))
      expect(await screen.findByText('Image too big')).toBeInTheDocument()
      expect(admin.createModule).not.toHaveBeenCalled()
    })

    it('shows a failed create, then clears it when reopened', async () => {
      admin.createModule.mockImplementation(() => httpError(409, { detail: 'Duplicate lesson' }))
      await openCreate()
      await userEvent.type(titleBox(), 'Optics')
      await userEvent.click(screen.getByRole('button', { name: 'Create Lesson' }))
      expect(await screen.findByText('Duplicate lesson')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.getByText('Duplicate lesson')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '+ Create Lesson' }))
      expect(screen.queryByText('Duplicate lesson')).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '✕' }))
      expect(screen.queryByRole('heading', { name: 'Create Lesson' })).not.toBeInTheDocument()
    })
  })

  describe('edit', () => {
    const openEdit = async (title = 'Waves') => {
      await renderPage()
      await userEvent.click(card(title).getByRole('button', { name: 'Edit' }))
    }
    const save = () => userEvent.click(screen.getByRole('button', { name: 'Update Lesson' }))

    it('keeps the current image and reloads', async () => {
      admin.updateModuleForCourse.mockResolvedValue({} as any)
      await openEdit()
      expect(screen.getByPlaceholderText('Lesson Title')).toHaveValue('Waves')
      expect(screen.getByPlaceholderText('Description')).toHaveValue('Sound and light')
      await save()
      expect(admin.updateModuleForCourse).toHaveBeenCalledWith('c1', 'm2', {
        title: 'Waves', description: 'Sound and light', order_number: 2, is_active: true,
        image_url: 'https://img/m2.png', image_public_id: 'pid-m2',
      })
      await waitFor(() => expect(admin.getModulesForCourse).toHaveBeenCalledTimes(2))
      expect(screen.queryByRole('heading', { name: 'Edit Lesson' })).not.toBeInTheDocument()
    })

    it('removes the image, with undo', async () => {
      admin.updateModuleForCourse.mockResolvedValue({} as any)
      admin.deleteImage.mockResolvedValue({} as any)
      await openEdit()
      await userEvent.click(screen.getByRole('button', { name: 'Remove Image' }))
      expect(screen.getByText('Selection: Image will be removed')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(screen.getByRole('img', { name: 'Current' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Remove Image' }))
      await save()
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-m2')
      await waitFor(() => expect(admin.updateModuleForCourse).toHaveBeenCalledWith('c1', 'm2', expect.objectContaining({ image_url: null, image_public_id: null })))
    })

    it('replaces the image and deletes the old one', async () => {
      admin.uploadImage.mockResolvedValue({ image_url: 'https://img/new.png', image_public_id: 'pid-new' } as any)
      admin.updateModuleForCourse.mockResolvedValue({} as any)
      await openEdit()
      await userEvent.upload(fileInput(), png())
      await save()
      await waitFor(() => expect(admin.updateModuleForCourse).toHaveBeenCalledWith('c1', 'm2', expect.objectContaining({ image_url: 'https://img/new.png', image_public_id: 'pid-new' })))
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-m2')
    })

    it('saves a lesson without an image', async () => {
      admin.updateModuleForCourse.mockResolvedValue({} as any)
      await openEdit('Motion')
      await userEvent.click(screen.getByRole('checkbox', { name: 'Lesson is visible to students' }))
      await save()
      expect(admin.updateModuleForCourse).toHaveBeenCalledWith('c1', 'm1', expect.objectContaining({ is_active: true, description: null, image_url: null }))
    })

    it('stops when the new image fails to upload', async () => {
      admin.uploadImage.mockImplementation(() => httpError(400, { detail: 'Bad image' }))
      await openEdit()
      await userEvent.upload(fileInput(), png())
      await save()
      expect(await screen.findByText('Bad image')).toBeInTheDocument()
      expect(admin.updateModuleForCourse).not.toHaveBeenCalled()
    })

    it('validates and reports a failed save', async () => {
      admin.updateModuleForCourse.mockImplementation(() => httpError(400, { detail: 'Order taken' }))
      await openEdit()
      const title = screen.getByPlaceholderText('Lesson Title')
      await userEvent.clear(title)
      await userEvent.type(title, ' ')
      fireEvent.submit(title.closest('form')!)
      expect(await screen.findByText('Please enter a title')).toBeInTheDocument()
      await userEvent.type(title, 'Waves II')
      await save()
      expect(await screen.findByText('Order taken')).toBeInTheDocument()
    })

    it('closes with Cancel or ✕', async () => {
      await openEdit()
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('heading', { name: 'Edit Lesson' })).not.toBeInTheDocument()
      await userEvent.click(card('Waves').getByRole('button', { name: 'Edit' }))
      await userEvent.click(screen.getByRole('button', { name: '✕' }))
      expect(screen.queryByRole('heading', { name: 'Edit Lesson' })).not.toBeInTheDocument()
    })
  })

  describe('delete', () => {
    it('deletes the lesson and its image after confirming', async () => {
      admin.deleteModuleForCourse.mockResolvedValue(undefined as any)
      admin.deleteImage.mockResolvedValue({} as any)
      confirmSpy.mockReturnValueOnce(false)
      await renderPage()
      await userEvent.click(card('Waves').getByRole('button', { name: 'Delete' }))
      expect(confirmSpy).toHaveBeenCalledWith('Delete lesson "Waves"? All videos and materials inside will also be deleted.')
      expect(admin.deleteModuleForCourse).not.toHaveBeenCalled()
      await userEvent.click(card('Waves').getByRole('button', { name: 'Delete' }))
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-m2')
      await waitFor(() => expect(admin.deleteModuleForCourse).toHaveBeenCalledWith('c1', 'm2'))
      await waitFor(() => expect(admin.getModulesForCourse).toHaveBeenCalledTimes(2))
    })

    it('shows a failed delete', async () => {
      admin.deleteModuleForCourse.mockImplementation(() => httpError(409, { detail: 'Lesson has videos' }))
      await renderPage()
      await userEvent.click(card('Motion').getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText('Lesson has videos')).toBeInTheDocument()
      expect(admin.deleteImage).not.toHaveBeenCalled()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('PerformanceAnalysis', () => {
  const analysis = {
    course_id: 'c1',
    overall_avg_score: 62,
    overall_failure_rate: 28,
    struggling_modules: [
      { id: 'm1', title: 'Vectors', type: 'exam', total_students: 40, failure_rate: 45, avg_score: 41 },
      { id: 'm2', title: 'Motion', type: 'video', total_students: 30, failure_rate: 25, avg_score: 58 },
      { id: 'm3', title: 'Units', type: 'exam', total_students: 20, failure_rate: 10, avg_score: 80 },
    ],
    hardest_exams: [
      { id: 'e1', title: 'Paper 1', attempt_count: 12, failure_rate: 60, avg_score: 38 },
      { id: 'e2', title: 'Paper 2', attempt_count: 8, failure_rate: 12.5, avg_score: 71 },
    ],
  }
  const render = (courseId = 'c1') => renderWithStore(<PerformanceAnalysis courseId={courseId} courseTitle="Physics" />, { store: asAdmin() })

  it('shows a spinner while analysing', () => {
    admin.getCourseStruggleAnalysis.mockReturnValue(new Promise(() => {}))
    render()
    expect(admin.getCourseStruggleAnalysis).toHaveBeenCalledWith('c1')
    expect(screen.getByText('Analyzing first-attempt results...')).toBeInTheDocument()
  })

  it('renders nothing without a course', () => {
    const { container } = render('')
    expect(admin.getCourseStruggleAnalysis).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a failed analysis', async () => {
    admin.getCourseStruggleAnalysis.mockImplementation(() => httpError(500, { detail: 'Analytics offline' }))
    render()
    expect(await screen.findByText('Analysis Failed')).toBeInTheDocument()
    expect(screen.getByText('Analytics offline')).toBeInTheDocument()
  })

  it('summarises modules and papers', async () => {
    admin.getCourseStruggleAnalysis.mockResolvedValue(analysis as any)
    const { container } = render()
    expect(await screen.findByText('62%')).toBeInTheDocument()
    expect(screen.getByText('28%')).toBeInTheDocument()
    expect(screen.getByText('Modules Analyzed').parentElement!.nextSibling).toHaveTextContent('3')
    expect(screen.getByText('Exams Analyzed').parentElement!.nextSibling).toHaveTextContent('2')

    const vectors = screen.getByText('Vectors').closest('.rounded-xl') as HTMLElement
    expect(within(vectors).getByText('45% Fail')).toHaveClass('text-rose-600')
    expect(within(vectors).getByText('40 Students')).toBeInTheDocument()
    expect(within(vectors).getByText('Avg Score: 41%')).toBeInTheDocument()
    expect(vectors.querySelector('.bg-rose-500')).toHaveStyle({ width: '45%' })
    const motion = screen.getByText('Motion').closest('.rounded-xl') as HTMLElement
    expect(within(motion).getByText('25% Fail')).toHaveClass('text-emerald-600')
    expect(motion.querySelector('.bg-amber-500')).not.toBeNull()
    expect((screen.getByText('Units').closest('.rounded-xl') as HTMLElement).querySelector('.bg-emerald-500')).not.toBeNull()

    const paper1 = screen.getByText('Paper 1').closest('.rounded-xl') as HTMLElement
    expect(within(paper1).getByText('60% Failed')).toBeInTheDocument()
    expect(within(paper1).getByText('Analyzed from 12 first attempts')).toBeInTheDocument()
    expect(within(paper1).getByText('38%')).toHaveClass('text-rose-600')
    expect(within(paper1).getByText('40.0%')).toBeInTheDocument()
    const paper2 = screen.getByText('Paper 2').closest('.rounded-xl') as HTMLElement
    expect(within(paper2).getByText('71%')).toHaveClass('text-emerald-600')
    expect(within(paper2).getByText('87.5%')).toBeInTheDocument()

    expect(screen.getByText('Action Plan: Curriculum Refinement')).toBeInTheDocument()
    expect((container.querySelector('.bg-indigo-500') as HTMLElement).style.width).toBe('62%')
  })

  it('says when there is nothing to analyse', async () => {
    admin.getCourseStruggleAnalysis.mockResolvedValue({ ...analysis, struggling_modules: [], hardest_exams: [] } as any)
    render()
    expect(await screen.findByText('No relevant module data found.')).toBeInTheDocument()
    expect(screen.getByText('No individual paper results analyzed.')).toBeInTheDocument()
  })
})
