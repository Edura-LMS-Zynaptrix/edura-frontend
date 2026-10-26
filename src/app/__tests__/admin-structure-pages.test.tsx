jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())
jest.mock('@/lib/api/auth')
jest.mock('@/lib/api/admin')

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as adminApi from '@/lib/api/admin'
import * as authApi from '@/lib/api/auth'
import SubjectsAndStreamsPage from '@/app/admin/streams/page'
import ClassPackagesPage from '@/app/admin/class-packages/page'
import { httpError } from '@/test-utils/api'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const admin = adminApi as jest.Mocked<typeof adminApi>
const auth = authApi as jest.Mocked<typeof authApi>

const asAdmin = () => makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: 'a1', role: 'admin' } as any } })
const asStudent = () => makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: 's1', role: 'student' } as any } })

let confirmSpy: jest.SpyInstance
beforeEach(() => {
  nav.reset()
  jest.resetAllMocks()
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => confirmSpy.mockRestore())

const streams = [
  { id: 's1', name: 'Physical Science', description: 'Maths stream', subjects: ['Physics', 'Combined Maths'], is_active: true },
  { id: 's2', name: 'Arts', description: null, subjects: ['Sinhala'], is_active: false },
]

// ─────────────────────────────────────────────────────────────────────────────
describe('Subjects & streams', () => {
  const subject = (id: string, extra: any = {}) => ({ id, name: `Subject ${id}`, grade: 10, is_active: true, ...extra })

  beforeEach(() => {
    admin.getStreams.mockResolvedValue(streams as any)
    admin.getGradeSubjects.mockResolvedValue([subject('1'), subject('2', { is_active: false })] as any)
  })

  it('sends visitors to log in', () => {
    nav.pathname = '/admin/streams'
    renderWithStore(<SubjectsAndStreamsPage />, { store: makeStore({ auth: { isInitialized: true } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fadmin%2Fstreams')
  })

  it('fetches the user when signed in without one', () => {
    auth.getCurrentUser.mockReturnValue(new Promise(() => {}))
    renderWithStore(<SubjectsAndStreamsPage />, { store: makeStore({ auth: { isAuthenticated: true, isInitialized: true } }) })
    expect(auth.getCurrentUser).toHaveBeenCalled()
    expect(screen.getByText('Verifying credentials...')).toBeInTheDocument()
  })

  it('sends non-admins home', () => {
    renderWithStore(<SubjectsAndStreamsPage />, { store: asStudent() })
    expect(nav.router.push).toHaveBeenCalledWith('/')
    expect(admin.getStreams).not.toHaveBeenCalled()
  })

  describe('subjects tab', () => {
    it('lists Grade 10 subjects first and counts active ones', async () => {
      renderWithStore(<SubjectsAndStreamsPage />, { store: asAdmin() })
      expect(await screen.findByText('Subject 1')).toBeInTheDocument()
      expect(admin.getGradeSubjects).toHaveBeenCalledWith(10)
      expect(screen.getByText('(1 active)')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/admin/dashboard')
    })

    it('switches grade', async () => {
      admin.getGradeSubjects.mockResolvedValueOnce([subject('1')] as any).mockResolvedValueOnce([])
      renderWithStore(<SubjectsAndStreamsPage />, { store: asAdmin() })
      await screen.findByText('Subject 1')
      await userEvent.click(screen.getByRole('button', { name: 'Grade 12' }))
      expect(await screen.findByText('No subjects yet for Grade 12.')).toBeInTheDocument()
      expect(admin.getGradeSubjects).toHaveBeenLastCalledWith(12)
    })

    it('adds a trimmed subject and reloads', async () => {
      admin.createGradeSubject.mockResolvedValue({} as any)
      renderWithStore(<SubjectsAndStreamsPage />, { store: asAdmin() })
      await screen.findByText('Subject 1')
      expect(screen.getByRole('button', { name: '+ Add' })).toBeDisabled()
      await userEvent.type(screen.getByPlaceholderText(/e.g. Mathematics/), '  ICT  ')
      await userEvent.click(screen.getByRole('button', { name: '+ Add' }))
      expect(admin.createGradeSubject).toHaveBeenCalledWith({ name: 'ICT', grade: 10 })
      await waitFor(() => expect(admin.getGradeSubjects).toHaveBeenCalledTimes(2))
      expect(screen.getByPlaceholderText(/e.g. Mathematics/)).toHaveValue('')
    })

    it('shows a failed add', async () => {
      admin.createGradeSubject.mockImplementation(() => httpError(409, { detail: 'Subject already exists' }))
      renderWithStore(<SubjectsAndStreamsPage />, { store: asAdmin() })
      await screen.findByText('Subject 1')
      await userEvent.type(screen.getByPlaceholderText(/e.g. Mathematics/), 'ICT')
      await userEvent.click(screen.getByRole('button', { name: '+ Add' }))
      expect(await screen.findByText('⚠️ Subject already exists')).toBeInTheDocument()
    })

    it('edits a subject name and status', async () => {
      admin.updateGradeSubject.mockResolvedValue({} as any)
      renderWithStore(<SubjectsAndStreamsPage />, { store: asAdmin() })
      await screen.findByText('Subject 1')
      await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
      const input = screen.getByDisplayValue('Subject 1')
      await userEvent.clear(input)
      await userEvent.type(input, 'Maths ')
      await userEvent.click(screen.getByLabelText('Active'))
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(admin.updateGradeSubject).toHaveBeenCalledWith('1', { name: 'Maths', is_active: false })
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument())
    })

    it('cancels an edit and reports a failed save', async () => {
      admin.updateGradeSubject.mockImplementation(() => httpError(400, {}))
      renderWithStore(<SubjectsAndStreamsPage />, { store: asAdmin() })
      await screen.findByText('Subject 1')
      await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByDisplayValue('Subject 1')).not.toBeInTheDocument()
      await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByText('⚠️ Failed to update subject')).toBeInTheDocument()
    })

    it('deletes a subject only after confirming', async () => {
      admin.deleteGradeSubject.mockResolvedValue(undefined as any)
      confirmSpy.mockReturnValueOnce(false)
      renderWithStore(<SubjectsAndStreamsPage />, { store: asAdmin() })
      await screen.findByText('Subject 1')
      await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
      expect(confirmSpy).toHaveBeenCalledWith('Delete "Subject 1" from Grade 10? Existing courses are not affected.')
      expect(admin.deleteGradeSubject).not.toHaveBeenCalled()
      await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
      expect(admin.deleteGradeSubject).toHaveBeenCalledWith('1')
    })

    it('shows a failed delete and a failed load', async () => {
      admin.deleteGradeSubject.mockImplementation(() => httpError(409, { detail: 'Subject in use' }))
      renderWithStore(<SubjectsAndStreamsPage />, { store: asAdmin() })
      await screen.findByText('Subject 1')
      await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
      expect(await screen.findByText('⚠️ Subject in use')).toBeInTheDocument()
      admin.getGradeSubjects.mockImplementation(() => httpError(500))
      await userEvent.click(screen.getByRole('button', { name: 'Grade 5' }))
      expect(await screen.findByText('⚠️ Failed to load subjects')).toBeInTheDocument()
    })
  })

  describe('streams tab', () => {
    const openStreams = async () => {
      renderWithStore(<SubjectsAndStreamsPage />, { store: asAdmin() })
      await userEvent.click(screen.getByRole('button', { name: 'Streams (A/L)' }))
      await screen.findByText('Physical Science')
    }

    it('lists streams with their subjects', async () => {
      await openStreams()
      expect(screen.getByText('"Maths stream"')).toBeInTheDocument()
      expect(screen.getByText('Combined Maths')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('shows an empty state', async () => {
      admin.getStreams.mockResolvedValue([])
      renderWithStore(<SubjectsAndStreamsPage />, { store: asAdmin() })
      await userEvent.click(screen.getByRole('button', { name: 'Streams (A/L)' }))
      expect(await screen.findByText('No streams configured yet.')).toBeInTheDocument()
    })

    it('creates a stream from comma-separated subjects', async () => {
      admin.createStream.mockResolvedValue({ id: 's3', name: 'Commerce', description: null, subjects: ['Accounting', 'Economics'], is_active: true } as any)
      await openStreams()
      await userEvent.click(screen.getByRole('button', { name: '+ New Stream' }))
      expect(screen.getByRole('heading', { name: 'Create Stream' })).toBeInTheDocument()
      await userEvent.type(screen.getByPlaceholderText('e.g. Technology, Commerce, Art'), 'Commerce')
      await userEvent.type(screen.getByPlaceholderText('Physics, Combined Maths, ICT, Chemistry'), 'Accounting, , Economics ')
      await userEvent.click(screen.getByRole('button', { name: 'Create' }))
      expect(admin.createStream).toHaveBeenCalledWith({ name: 'Commerce', description: undefined, subjects: ['Accounting', 'Economics'] })
      expect(await screen.findByText('Commerce')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Create Stream' })).not.toBeInTheDocument()
    })

    it('needs at least one real subject', async () => {
      await openStreams()
      await userEvent.click(screen.getByRole('button', { name: '+ New Stream' }))
      await userEvent.type(screen.getByPlaceholderText('e.g. Technology, Commerce, Art'), 'X')
      await userEvent.type(screen.getByPlaceholderText('Physics, Combined Maths, ICT, Chemistry'), ' , ')
      await userEvent.click(screen.getByRole('button', { name: 'Create' }))
      expect(screen.getByText('⚠️ Add at least one subject')).toBeInTheDocument()
      expect(admin.createStream).not.toHaveBeenCalled()
    })

    it('shows a failed create', async () => {
      admin.createStream.mockImplementation(() => httpError(409, { detail: 'Stream exists' }))
      await openStreams()
      await userEvent.click(screen.getByRole('button', { name: '+ New Stream' }))
      await userEvent.type(screen.getByPlaceholderText('e.g. Technology, Commerce, Art'), 'Arts')
      await userEvent.type(screen.getByPlaceholderText('Physics, Combined Maths, ICT, Chemistry'), 'Sinhala')
      await userEvent.click(screen.getByRole('button', { name: 'Create' }))
      expect(await screen.findByText('⚠️ Stream exists')).toBeInTheDocument()
    })

    it('edits a stream, including its status', async () => {
      admin.updateStream.mockResolvedValue({ ...streams[0], name: 'Physical Sci', is_active: false } as any)
      await openStreams()
      await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
      expect(screen.getByDisplayValue('Physics, Combined Maths')).toBeInTheDocument()
      const name = screen.getByDisplayValue('Physical Science')
      await userEvent.clear(name)
      await userEvent.type(name, 'Physical Sci')
      await userEvent.click(screen.getByLabelText('Stream is active'))
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
      expect(admin.updateStream).toHaveBeenCalledWith('s1', {
        name: 'Physical Sci', description: 'Maths stream', subjects: ['Physics', 'Combined Maths'], is_active: false,
      })
      expect(await screen.findByText('Physical Sci')).toBeInTheDocument()
    })

    it('needs a subject when editing and reports failures', async () => {
      admin.updateStream.mockImplementation(() => httpError(500, { detail: 'Update failed' }))
      await openStreams()
      await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1])
      await userEvent.clear(screen.getByDisplayValue('Sinhala'))
      await userEvent.type(screen.getByPlaceholderText('Physics, Combined Maths, ICT, Chemistry'), ',')
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
      expect(screen.getByText('⚠️ Add at least one subject')).toBeInTheDocument()
      await userEvent.type(screen.getByPlaceholderText('Physics, Combined Maths, ICT, Chemistry'), 'Tamil')
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
      expect(await screen.findByText('⚠️ Update failed')).toBeInTheDocument()
    })

    it('closes the modal with ✕ and Cancel', async () => {
      await openStreams()
      await userEvent.click(screen.getByRole('button', { name: '+ New Stream' }))
      await userEvent.click(screen.getByRole('button', { name: '✕' }))
      expect(screen.queryByRole('heading', { name: 'Create Stream' })).not.toBeInTheDocument()
      await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('heading', { name: 'Edit Stream' })).not.toBeInTheDocument()
    })

    it('deletes a stream after confirming, and shows failures', async () => {
      admin.deleteStream.mockResolvedValueOnce(undefined as any).mockImplementationOnce(() => httpError(409, { detail: 'Stream in use' }))
      await openStreams()
      await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
      expect(admin.deleteStream).toHaveBeenCalledWith('s1')
      await waitFor(() => expect(screen.queryByText('Physical Science')).not.toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText('⚠️ Stream in use')).toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Class packages (admin)', () => {
  const pkg = (id: string, extra: any = {}) => ({
    id, name: `Package ${id}`, description: null, grade: 10, stream_id: null, stream_name: null, price: 0, is_active: true, ...extra,
  })

  beforeEach(() => {
    admin.getStreams.mockResolvedValue(streams as any)
    admin.getClassPackages.mockResolvedValue([
      pkg('p1', { grade: 8 }),
      pkg('p2', { grade: 11, price: 3000, description: 'All O/L subjects' }),
      pkg('p3', { grade: 13, stream_id: 's1', stream_name: 'Physical Science', is_active: false }),
    ] as any)
  })

  it('fetches the user when auth is not initialised', () => {
    auth.getCurrentUser.mockReturnValue(new Promise(() => {}))
    const { container } = renderWithStore(<ClassPackagesPage />)
    expect(auth.getCurrentUser).toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('sends visitors to log in and students to their courses', () => {
    renderWithStore(<ClassPackagesPage />, { store: makeStore({ auth: { isInitialized: true } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/login')
    nav.reset()
    renderWithStore(<ClassPackagesPage />, { store: asStudent() })
    expect(nav.router.push).toHaveBeenCalledWith('/student/courses')
  })

  it('groups packages by level', async () => {
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    expect(await screen.findByText('Package p1')).toBeInTheDocument()
    expect(admin.getStreams).toHaveBeenCalled()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Primary — Grade 8', 'O/L — Grade 11', 'A/L — Grade 13',
    ])
    expect(screen.getByText('LKR 3,000')).toBeInTheDocument()
    expect(screen.getByText('All O/L subjects')).toBeInTheDocument()
    expect(screen.getByText('Physical Science')).toBeInTheDocument()
    expect(screen.getByText('3 package(s)')).toBeInTheDocument()
  })

  it('filters by grade and status', async () => {
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    await screen.findByText('Package p1')
    const [grade, status] = screen.getAllByRole('combobox')
    await userEvent.selectOptions(grade, '11')
    expect(screen.getByText('1 package(s)')).toBeInTheDocument()
    await userEvent.selectOptions(grade, 'all')
    await userEvent.selectOptions(status, 'inactive')
    expect(screen.getByText('Package p3')).toBeInTheDocument()
    expect(screen.queryByText('Package p1')).not.toBeInTheDocument()
    await userEvent.selectOptions(status, 'active')
    expect(screen.getByText('2 package(s)')).toBeInTheDocument()
  })

  it('shows an empty state and the load error', async () => {
    admin.getClassPackages.mockImplementation(() => httpError(500, { detail: 'Course service down' }))
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    expect(await screen.findByText('Course service down')).toBeInTheDocument()
    expect(screen.getByText('No class packages yet.')).toBeInTheDocument()
  })

  it.each([
    [{ count: 0, created: [] }, 'All class packages already exist — nothing to generate.'],
    [{ count: 2, created: ['Grade 9 Class', 'Grade 10 Class'] }, 'Generated 2 new package(s): Grade 9 Class, Grade 10 Class'],
  ])('auto-generates missing packages (%o)', async (res, message) => {
    admin.autoGenerateClassPackages.mockResolvedValue(res as any)
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    await screen.findByText('Package p1')
    await userEvent.click(screen.getByRole('button', { name: /Auto-Generate Missing/ }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(admin.getClassPackages).toHaveBeenCalledTimes(2)
    await userEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(screen.queryByText(message)).not.toBeInTheDocument()
  })

  it('reports a failed auto-generate', async () => {
    admin.autoGenerateClassPackages.mockImplementation(() => httpError(500, { detail: 'Generation failed' }))
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: /Auto-Generate Missing/ }))
    expect(await screen.findByText('Generation failed')).toBeInTheDocument()
  })

  it('creates a package, naming it from the grade and stream', async () => {
    admin.createClassPackage.mockResolvedValue({} as any)
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    await screen.findByText('Package p1')
    await userEvent.click(screen.getByRole('button', { name: '+ New Package' }))
    const modal = screen.getByRole('heading', { name: 'Create Class Package' }).closest('.rounded-2xl') as HTMLElement
    const gradeSelect = within(modal).getAllByRole('combobox')[0]
    expect(within(gradeSelect).getByRole('option', { name: 'Grade 11 (covers 10 & 11)' })).toBeInTheDocument()
    await userEvent.selectOptions(gradeSelect, '9')
    expect(within(modal).getByPlaceholderText('e.g. Grade 10 Class')).toHaveValue('Grade 9 Class')
    await userEvent.selectOptions(gradeSelect, '13')
    expect(within(modal).getByPlaceholderText('e.g. Grade 10 Class')).toHaveValue('Grade 13')
    await userEvent.selectOptions(within(modal).getAllByRole('combobox')[1], 's1')
    expect(within(modal).getByPlaceholderText('e.g. Grade 10 Class')).toHaveValue('Grade 13 - Physical Science')
    await userEvent.selectOptions(gradeSelect, '12')
    expect(within(modal).getByPlaceholderText('e.g. Grade 10 Class')).toHaveValue('Grade 12 - Physical Science')
    await userEvent.type(within(modal).getByPlaceholderText('What does this package include?'), 'Everything')
    const price = within(modal).getByRole('spinbutton')
    await userEvent.clear(price)
    await userEvent.type(price, '4500')
    await userEvent.click(within(modal).getByLabelText('Active (visible to students)'))
    await userEvent.click(within(modal).getByRole('button', { name: 'Create Package' }))
    expect(admin.createClassPackage).toHaveBeenCalledWith({
      name: 'Grade 12 - Physical Science', description: 'Everything', grade: 12, stream_id: 's1', price: 4500, is_active: false,
    })
    expect(await screen.findByText('Class package created.')).toBeInTheDocument()
  })

  it('drops the stream when the grade goes below A/L', async () => {
    admin.createClassPackage.mockResolvedValue({} as any)
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: '+ New Package' }))
    const [grade] = screen.getAllByRole('combobox').slice(-1)
    await userEvent.selectOptions(grade, '13')
    await userEvent.selectOptions(screen.getAllByRole('combobox').slice(-1)[0], 's1')
    await userEvent.selectOptions(screen.getAllByRole('combobox').slice(-2)[0], '10')
    expect(screen.queryByText('Stream (A/L only)')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create Package' }))
    expect(admin.createClassPackage).toHaveBeenCalledWith(expect.objectContaining({ grade: 10, stream_id: null, name: 'Grade 10 Class' }))
  })

  it('edits a package without renaming it', async () => {
    admin.updateClassPackage.mockResolvedValue({} as any)
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    await screen.findByText('Package p1')
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[2])
    expect(screen.getByRole('heading', { name: 'Edit Class Package' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getAllByRole('combobox').slice(-1)[0], '')
    expect(screen.getByDisplayValue('Package p3')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(admin.updateClassPackage).toHaveBeenCalledWith('p3', expect.objectContaining({ name: 'Package p3', stream_id: null, is_active: false }))
    expect(await screen.findByText('Class package updated.')).toBeInTheDocument()
  })

  it('keeps the form open with the error when saving fails', async () => {
    admin.createClassPackage.mockImplementation(() => httpError(409, { detail: 'Package exists' }))
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByRole('button', { name: '+ New Package' }))
    await userEvent.type(screen.getByPlaceholderText('e.g. Grade 10 Class'), 'Dup')
    await userEvent.click(screen.getByRole('button', { name: 'Create Package' }))
    const modal = screen.getByRole('heading', { name: 'Create Class Package' }).closest('.rounded-2xl') as HTMLElement
    expect(await within(modal).findByText('Package exists')).toBeInTheDocument()
    await userEvent.click(within(modal).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'Create Class Package' })).not.toBeInTheDocument()
  })

  it('deletes a package after confirming in the dialog', async () => {
    admin.deleteClassPackage.mockResolvedValue(undefined as any)
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    await screen.findByText('Package p1')
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    expect(screen.getByRole('heading', { name: 'Delete Package?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(admin.deleteClassPackage).not.toHaveBeenCalled()
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    const dialog = screen.getByRole('heading', { name: 'Delete Package?' }).parentElement!
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(admin.deleteClassPackage).toHaveBeenCalledWith('p1')
    expect(await screen.findByText('Class package deleted.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Delete Package?' })).not.toBeInTheDocument()
  })

  it('reports a failed delete', async () => {
    admin.deleteClassPackage.mockImplementation(() => httpError(409, { detail: 'Package has students' }))
    renderWithStore(<ClassPackagesPage />, { store: asAdmin() })
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[0])
    const dialog = screen.getByRole('heading', { name: 'Delete Package?' }).parentElement!
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Package has students')).toBeInTheDocument()
  })
})
