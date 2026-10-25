jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())
jest.mock('@/lib/api/auth')
jest.mock('@/lib/api/admin')
jest.mock('react-hot-toast', () => {
  const toast = { success: jest.fn(), error: jest.fn() }
  return { __esModule: true, default: toast, toast }
})
jest.mock('@/components/analytics/ProgressCharts', () => ({
  MasteryRadarChart: ({ data }: any) => <div data-testid="radar">{data.map((d: any) => `${d.subject}:${d.score}`).join(',')}</div>,
  PerformanceLineChart: ({ data }: any) => <div data-testid="trend">{data.map((d: any) => d.score).join(',')}</div>,
}))
jest.mock('@/components/analytics/AttemptReviewContent', () => ({
  __esModule: true,
  default: ({ result }: any) => <div data-testid="review">{result.review.length} answers</div>,
}))

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'react-hot-toast'
import * as adminApi from '@/lib/api/admin'
import * as authApi from '@/lib/api/auth'
import AdminStudentsPage from '@/app/admin/students/page'
import AdminStudentProgressPage from '@/app/admin/students/[userId]/progress/page'
import AdminAttemptReviewPage from '@/app/admin/students/[userId]/progress/attempt/[attemptId]/page'
import AdminsPage from '@/app/admin/admins/page'
import { httpError } from '@/test-utils/api'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const admin = adminApi as jest.Mocked<typeof adminApi>
const auth = authApi as jest.Mocked<typeof authApi>

const adminUser = { id: 'a1', email: 'admin@edura.lk', role: 'admin', is_active: true, profile: { full_name: 'Nimal Silva' } }
const asAdmin = (extra: any = {}) =>
  makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: adminUser as any }, ...extra })
const asStudent = () =>
  makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: 's1', role: 'student' } as any } })

let confirmSpy: jest.SpyInstance
beforeEach(() => {
  nav.reset()
  jest.resetAllMocks()
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => confirmSpy.mockRestore())

// ─────────────────────────────────────────────────────────────────────────────
describe('Manage students', () => {
  const student = (id: string, extra: any = {}) => ({
    user_id: id, full_name: `kasun ${id}`, email: `${id}@example.com`, grade: 11, phone_number: '0771234567',
    parent_phone_number: null, district: 'Colombo', school: 'Royal College', enrollment_count: 2, attempt_count: 5,
    is_active: true, needs_profile_completion: false, profile_photo_url: null, ...extra,
  })

  const lastParams = () => admin.getAdminStudents.mock.calls[admin.getAdminStudents.mock.calls.length - 1][0]

  beforeEach(() => {
    admin.getAdminStudents.mockResolvedValue({ students: [student('u1'), student('u2', { is_active: false })], total: 2 } as any)
  })

  it('sends non-admins home without loading students', () => {
    renderWithStore(<AdminStudentsPage />, { store: asStudent() })
    expect(nav.router.push).toHaveBeenCalledWith('/')
    expect(admin.getAdminStudents).not.toHaveBeenCalled()
  })

  it('lists students with their details', async () => {
    admin.getAdminStudents.mockResolvedValue({
      students: [
        student('u1', { needs_profile_completion: true, parent_phone_number: '0719999999' }),
        student('u2', { is_active: false, phone_number: null, profile_photo_url: 'https://cdn/u2.png' }),
      ],
      total: 2,
    } as any)
    renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    expect(await screen.findByText('kasun u1')).toBeInTheDocument()
    expect(admin.getAdminStudents).toHaveBeenCalledWith({ skip: 0, limit: 20 })
    expect(screen.getByText('2 students registered')).toBeInTheDocument()
    expect(screen.getByText('Incomplete')).toBeInTheDocument()
    expect(screen.getByText('P: 0719999999')).toBeInTheDocument()
    expect(screen.getByText('No Phone')).toBeInTheDocument()
    expect(screen.getByText('K')).toBeInTheDocument() // initial for the student without a photo
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Active')).toBeInTheDocument()
    expect(within(rows[0]).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
    expect(within(rows[1]).getByText('Inactive')).toBeInTheDocument()
    expect(within(rows[1]).getByRole('button', { name: 'Activate' })).toBeInTheDocument()
  })

  it('uses the singular for one student and shows an empty table', async () => {
    admin.getAdminStudents.mockResolvedValue({ students: [], total: 1 } as any)
    renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    expect(await screen.findByText('No students found')).toBeInTheDocument()
    expect(screen.getByText('1 student registered')).toBeInTheDocument()
  })

  it('sends each filter to the API', async () => {
    renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    await screen.findByText('kasun u1')
    await userEvent.type(screen.getByPlaceholderText('Search name, email, school or phone…'), 'kas')
    await waitFor(() => expect(lastParams()).toEqual({ skip: 0, limit: 20, search: 'kas' }))
    await userEvent.selectOptions(screen.getByRole('combobox'), '12')
    await waitFor(() => expect(lastParams()).toMatchObject({ grade: 12 }))
    await userEvent.type(screen.getByPlaceholderText('District…'), 'Galle')
    await waitFor(() => expect(lastParams()).toMatchObject({ district: 'Galle' }))
    await userEvent.click(screen.getByRole('button', { name: 'inactive' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ is_active: false }))
    await userEvent.click(screen.getByRole('button', { name: 'active' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ is_active: true }))
    await userEvent.selectOptions(screen.getByRole('combobox'), '')
    await waitFor(() => expect(lastParams()).not.toHaveProperty('grade'))
  })

  it('pages through results', async () => {
    admin.getAdminStudents.mockResolvedValue({ students: [student('u1')], total: 45 } as any)
    renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    expect(await screen.findByText('Showing 1–20 of 45')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(lastParams()).toEqual({ skip: 20, limit: 20 }))
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Showing 41–45 of 45')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
    await waitFor(() => expect(lastParams()).toEqual({ skip: 20, limit: 20 }))
  })

  it('a new filter goes back to the first page', async () => {
    admin.getAdminStudents.mockResolvedValue({ students: [student('u1')], total: 45 } as any)
    renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'all' }))
    await waitFor(() => expect(lastParams()).toEqual({ skip: 0, limit: 20 }))
  })

  it('opens a student\'s progress', async () => {
    renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    await userEvent.click((await screen.findAllByRole('button', { name: 'Progress' }))[1])
    expect(nav.router.push).toHaveBeenCalledWith('/admin/students/u2/progress')
  })

  it('toggles a student\'s status in place', async () => {
    admin.toggleStudentActive.mockResolvedValue({ user_id: 'u1', is_active: false } as any)
    renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }))
    expect(admin.toggleStudentActive).toHaveBeenCalledWith('u1')
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Activate' })).toHaveLength(2))
  })

  it('shows a failed toggle', async () => {
    admin.toggleStudentActive.mockImplementation(() => httpError(500, { detail: 'Auth service down' }))
    renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByText('Auth service down')).toBeInTheDocument()
  })

  it('deletes a student only after confirming', async () => {
    admin.deleteStudent.mockResolvedValue(undefined as any)
    confirmSpy.mockReturnValueOnce(false)
    renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    await userEvent.click((await screen.findAllByTitle('Permanently Delete'))[0])
    expect(confirmSpy.mock.calls[0][0]).toContain('PERMANENT DELETE: "kasun u1"')
    expect(admin.deleteStudent).not.toHaveBeenCalled()
    await userEvent.click(screen.getAllByTitle('Permanently Delete')[0])
    expect(admin.deleteStudent).toHaveBeenCalledWith('u1')
    await waitFor(() => expect(screen.queryByText('kasun u1')).not.toBeInTheDocument())
    expect(screen.getByText('1 student registered')).toBeInTheDocument()
  })

  it('shows a failed delete', async () => {
    admin.deleteStudent.mockImplementation(() => httpError(409, { detail: 'Student has payments' }))
    renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    await userEvent.click((await screen.findAllByTitle('Permanently Delete'))[0])
    expect(await screen.findByText('Student has payments')).toBeInTheDocument()
    expect(screen.getByText('kasun u1')).toBeInTheDocument()
  })

  it('shows skeleton rows while loading', () => {
    admin.getAdminStudents.mockReturnValue(new Promise(() => {}))
    const { container } = renderWithStore(<AdminStudentsPage />, { store: asAdmin() })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(8)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Student progress (admin)', () => {
  const progress = {
    student: { full_name: 'Kasun Perera', grade: 13, district: 'Galle', phone_number: '0771112222', parent_phone_number: null },
    overall: { avg_time_seconds: 1500, total_attempts_made: 7 },
    subjects: [
      {
        subject: 'Physics', course_title: 'A/L Physics', best_score_pct: 90, avg_score_pct: 82, avg_time_seconds: 1200,
        total_attempts_count: 4, score_trend: [60, 90],
        exams: [
          {
            id: 'e1', title: 'Paper 1', attempts_count: 2, best_score_pct: 90,
            history: [
              { id: 'at1', attempt_number: 1, score_pct: 60, time_seconds: 1800, submitted_at: '2026-02-01T10:00:00Z' },
              { id: 'at2', attempt_number: 2, score_pct: 90, time_seconds: 1500, submitted_at: null },
            ],
          },
          { id: 'e2', title: 'Paper 2', attempts_count: 0, best_score_pct: 0, history: [] },
        ],
      },
      {
        subject: 'Chemistry', course_title: 'A/L Chem', best_score_pct: 45, avg_score_pct: 30, avg_time_seconds: 900,
        total_attempts_count: 3, score_trend: null, exams: [],
      },
    ],
  }

  beforeEach(() => {
    nav.params = { userId: 'u9' }
  })

  it('loads the student\'s progress', async () => {
    admin.getStudentProgress.mockReturnValue(new Promise(() => {}))
    renderWithStore(<AdminStudentProgressPage />, { store: asAdmin() })
    expect(screen.getByText('Assembling Diagnostic Data...')).toBeInTheDocument()
    expect(admin.getStudentProgress).toHaveBeenCalledWith('u9')
  })

  it('shows the header, metrics, contacts and subject cards', async () => {
    admin.getStudentProgress.mockResolvedValue(progress as any)
    renderWithStore(<AdminStudentProgressPage />, { store: asAdmin() })
    expect(await screen.findByRole('heading', { name: 'Kasun Perera' })).toBeInTheDocument()
    expect(screen.getByText('Grade 13')).toBeInTheDocument()
    expect(screen.getByText('25m')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('0771112222')).toBeInTheDocument()
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.getByTestId('radar')).toHaveTextContent('Physics:90,Chemistry:45')
    expect(screen.getAllByText('82%')[0]).toHaveClass('text-emerald-500')
    expect(screen.getAllByText('30%')[0]).toHaveClass('text-rose-500')
  })

  it('expands a subject to list its exams', async () => {
    admin.getStudentProgress.mockResolvedValue(progress as any)
    renderWithStore(<AdminStudentProgressPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('heading', { name: 'Physics' }))
    expect(screen.getByText('Attempt Inventory')).toBeInTheDocument()
    expect(screen.getByText('4 total entries')).toBeInTheDocument()
    expect(screen.getByText('2 Attempts Found')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('heading', { name: 'Physics' }))
    expect(screen.queryByText('Attempt Inventory')).not.toBeInTheDocument()
  })

  it('lists attempt history and opens an attempt', async () => {
    admin.getStudentProgress.mockResolvedValue(progress as any)
    renderWithStore(<AdminStudentProgressPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: /Recent Raw Data/ }))
    expect(screen.getByRole('heading', { name: 'Paper 1' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Paper 2' })).not.toBeInTheDocument() // never attempted
    expect(screen.getByText('Attempt #1')).toBeInTheDocument()
    expect(screen.getByText('60%')).toHaveClass('text-amber-600')
    expect(screen.getAllByText('90%')[1]).toHaveClass('text-emerald-600')
    expect(screen.getByText('N/A')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: /Review Results/ })[1])
    expect(nav.router.push).toHaveBeenCalledWith('/admin/students/u9/progress/attempt/at2')
    await userEvent.click(screen.getByRole('button', { name: /Analytics/ }))
    expect(screen.getByText('Mastery Signature')).toBeInTheDocument()
  })

  it('dispatches the report and toasts the result', async () => {
    admin.getStudentProgress.mockResolvedValue(progress as any)
    admin.sendStudentReportDetail.mockResolvedValue({ message: 'Report emailed to parent' } as any)
    renderWithStore(<AdminStudentProgressPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: /Dispatch Report/ }))
    expect(admin.sendStudentReportDetail).toHaveBeenCalledWith('u9')
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Report emailed to parent'))
  })

  it('uses a default success message', async () => {
    admin.getStudentProgress.mockResolvedValue(progress as any)
    admin.sendStudentReportDetail.mockResolvedValue({} as any)
    renderWithStore(<AdminStudentProgressPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: /Dispatch Report/ }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Report sent successfully'))
  })

  it('toasts a failed report', async () => {
    admin.getStudentProgress.mockResolvedValue(progress as any)
    admin.sendStudentReportDetail.mockImplementation(() => httpError(502, { detail: 'Mail server down' }))
    renderWithStore(<AdminStudentProgressPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: /Dispatch Report/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Mail server down'))
  })

  it('shows a load error with a way back', async () => {
    admin.getStudentProgress.mockImplementation(() => httpError(404, { detail: 'Student not found' }))
    renderWithStore(<AdminStudentProgressPage />, { store: asAdmin() })
    expect(await screen.findByText('Calculation Error')).toBeInTheDocument()
    expect(screen.getByText('Student not found')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Return to Console' }))
    expect(nav.router.back).toHaveBeenCalled()
  })

  it('clears the error when leaving', async () => {
    admin.getStudentProgress.mockImplementation(() => httpError(404, { detail: 'Student not found' }))
    const { store, unmount } = renderWithStore(<AdminStudentProgressPage />, { store: asAdmin() })
    await screen.findByText('Student not found')
    unmount()
    expect(store.getState().admin.error).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Attempt review (admin)', () => {
  const review = { marks_obtained: 17, total_questions: 20, ranking: { exam_title: 'Physics Paper 1' }, review: [{}, {}] }

  beforeEach(() => {
    nav.params = { userId: 'u9', attemptId: 'at2' }
  })

  it('loads and shows the attempt', async () => {
    admin.fetchStudentAttemptReview.mockResolvedValue(review)
    renderWithStore(<AdminAttemptReviewPage />, { store: asAdmin() })
    expect(screen.getByText('Retrieving Submission Audit...')).toBeInTheDocument()
    expect(await screen.findByText('85% SUBMISSION')).toHaveClass('text-emerald-700')
    expect(admin.fetchStudentAttemptReview).toHaveBeenCalledWith('u9', 'at2')
    expect(screen.getByRole('heading', { name: 'Physics Paper 1' })).toBeInTheDocument()
    expect(screen.getByTestId('review')).toHaveTextContent('2 answers')
  })

  it('marks scores under 85% as not passed and navigates back', async () => {
    admin.fetchStudentAttemptReview.mockResolvedValue({ ...review, marks_obtained: 8 })
    renderWithStore(<AdminAttemptReviewPage />, { store: asAdmin() })
    expect(await screen.findByText('40% SUBMISSION')).toHaveClass('text-red-700')
    await userEvent.click(screen.getByRole('button', { name: /Back to Audit/ }))
    await userEvent.click(screen.getByRole('button', { name: 'CLOSE AUDIT VIEW' }))
    expect(nav.router.back).toHaveBeenCalledTimes(2)
  })

  it('shows the error', async () => {
    admin.fetchStudentAttemptReview.mockImplementation(() => httpError(404, { detail: 'Attempt not found' }))
    renderWithStore(<AdminAttemptReviewPage />, { store: asAdmin() })
    expect(await screen.findByText('Audit Failed')).toBeInTheDocument()
    expect(screen.getByText('Attempt not found')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Progress' }))
    expect(nav.router.back).toHaveBeenCalled()
  })

  it('does nothing without both ids', () => {
    nav.params = { userId: 'u9' }
    renderWithStore(<AdminAttemptReviewPage />, { store: asAdmin() })
    expect(admin.fetchStudentAttemptReview).not.toHaveBeenCalled()
    expect(screen.getByText('Attempt data is unavailable')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Manage admins', () => {
  const other = (id: string, extra: any = {}) => ({
    id, full_name: `admin ${id}`, email: `${id}@edura.lk`, is_active: true, created_at: new Date().toISOString(), ...extra,
  })

  it('sends visitors to log in', () => {
    nav.pathname = '/admin/admins'
    renderWithStore(<AdminsPage />, { store: makeStore({ auth: { isInitialized: true } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fadmin%2Fadmins')
  })

  it('fetches the user when signed in without one', () => {
    auth.getCurrentUser.mockReturnValue(new Promise(() => {}))
    renderWithStore(<AdminsPage />, { store: makeStore({ auth: { isAuthenticated: true, isInitialized: true } }) })
    expect(auth.getCurrentUser).toHaveBeenCalled()
  })

  it.each(['student', 'super_admin'])('sends a %s to the admin dashboard', (role) => {
    renderWithStore(<AdminsPage />, { store: makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: 'x', role } as any } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/admin/dashboard')
    expect(admin.getSubAdmins).not.toHaveBeenCalled()
  })

  it('lists the other admins', async () => {
    admin.getSubAdmins.mockResolvedValue({ total: 0, admins: [other('b1'), other('b2', { is_active: false })] } as any)
    renderWithStore(<AdminsPage />, { store: asAdmin() })
    expect(await screen.findByText('admin b1')).toBeInTheDocument()
    expect(screen.getByText('b2@edura.lk')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getAllByText('Administrator', { selector: 'span' })).toHaveLength(2)
  })

  it('shows an empty list and load errors', async () => {
    admin.getSubAdmins.mockImplementation(() => httpError(500, { detail: 'Could not load admins' }))
    renderWithStore(<AdminsPage />, { store: asAdmin() })
    expect(await screen.findByText('Could not load admins')).toBeInTheDocument()
    expect(screen.getByText('No other admins yet')).toBeInTheDocument()
  })

  it('creates an admin and closes the form', async () => {
    admin.getSubAdmins.mockResolvedValue({ total: 0, admins: [] } as any)
    admin.createSubAdmin.mockResolvedValue(other('new', { full_name: 'Sunil Fernando' }) as any)
    renderWithStore(<AdminsPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: /Add New Admin/ }))
    await userEvent.type(screen.getByPlaceholderText('e.g. John Doe'), 'Sunil Fernando')
    await userEvent.type(screen.getByPlaceholderText('admin@edura.lk'), 'sunil@edura.lk')
    const pw = screen.getByPlaceholderText('••••••••')
    await userEvent.type(pw, 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(pw).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(pw).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))
    expect(admin.createSubAdmin).toHaveBeenCalledWith({ full_name: 'Sunil Fernando', email: 'sunil@edura.lk', password: 'secret123' })
    expect(await screen.findByText('Sunil Fernando')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('e.g. John Doe')).not.toBeInTheDocument()
  })

  it('shows a failed create in the form', async () => {
    admin.getSubAdmins.mockResolvedValue({ total: 0, admins: [] } as any)
    admin.createSubAdmin.mockImplementation(() => httpError(409, { detail: 'Email already registered' }))
    renderWithStore(<AdminsPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: /Add New Admin/ }))
    await userEvent.type(screen.getByPlaceholderText('e.g. John Doe'), 'S')
    await userEvent.type(screen.getByPlaceholderText('admin@edura.lk'), 's@edura.lk')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))
    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })

  it('cancel and the backdrop close the form', async () => {
    admin.getSubAdmins.mockResolvedValue({ total: 0, admins: [] } as any)
    const { container } = renderWithStore(<AdminsPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: /Add New Admin/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Initial Password')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Add New Admin/ }))
    await userEvent.click(container.querySelector('.backdrop-blur-sm') as HTMLElement)
    expect(screen.queryByText('Initial Password')).not.toBeInTheDocument()
  })

  it('removes an admin after confirming', async () => {
    admin.getSubAdmins.mockResolvedValue({ total: 0, admins: [other('b1')] } as any)
    admin.deleteSubAdmin.mockResolvedValue(undefined as any)
    confirmSpy.mockReturnValueOnce(false)
    renderWithStore(<AdminsPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByTitle('Remove Admin'))
    expect(admin.deleteSubAdmin).not.toHaveBeenCalled()
    await userEvent.click(screen.getByTitle('Remove Admin'))
    expect(admin.deleteSubAdmin).toHaveBeenCalledWith('b1')
    expect(await screen.findByText('No other admins yet')).toBeInTheDocument()
  })

  it('alerts when removing fails', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    admin.getSubAdmins.mockResolvedValue({ total: 0, admins: [other('b1')] } as any)
    admin.deleteSubAdmin.mockImplementation(() => httpError(403, { detail: 'Cannot remove yourself' }))
    renderWithStore(<AdminsPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByTitle('Remove Admin'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Cannot remove yourself'))
    alertSpy.mockRestore()
  })
})
