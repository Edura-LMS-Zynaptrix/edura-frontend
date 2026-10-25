jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())
jest.mock('@/lib/api/auth')
jest.mock('@/lib/api/admin')

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as adminApi from '@/lib/api/admin'
import * as authApi from '@/lib/api/auth'
import ModuleContentPage from '@/app/admin/courses/[courseId]/video-modules/[moduleId]/videos/page'
import { httpError } from '@/test-utils/api'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const admin = adminApi as jest.Mocked<typeof adminApi>
const auth = authApi as jest.Mocked<typeof authApi>

const asRole = (role: string, extra: any = {}) =>
  makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: 'a1', role } as any }, ...extra })
const physics = { id: 'c1', title: 'Physics Videos', subject: 'Physics', grade: 12, course_type: 'video', image_url: null, price: 0, stream_ids: [] }
const withCourse = (role = 'admin') => asRole(role, { courses: { courses: [physics] } })

const video = (id: string, extra: any = {}) => ({
  id, title: `Video ${id}`, description: '', yt_video_id: 'dQw4w9WgXcQ', duration_seconds: 0, order_number: 1, is_published: true, ...extra,
})
const material = (id: string, extra: any = {}) => ({
  id, title: `Material ${id}`, file_url: `https://files/${id}.pdf`, file_public_id: null, file_type: 'pdf', order_number: 1, video_id: null, ...extra,
})
const videos = [
  video('v2', { title: 'Interference', yt_video_id: 'https://youtu.be/abcdefghijk', duration_seconds: 125, order_number: 2, is_published: false }),
  video('v1', { title: 'Intro', description: 'Start here', duration_seconds: 600, order_number: 1 }),
]
const materials = [
  material('mat1', { title: 'Notes', video_id: 'v1', order_number: 2 }),
  material('mat2', { title: 'Slides', video_id: 'v1', order_number: 1, file_public_id: 'pid-mat2' }),
  material('mat3', { title: 'Syllabus' }),
]

let confirmSpy: jest.SpyInstance
let alertSpy: jest.SpyInstance
beforeEach(() => {
  nav.reset()
  jest.resetAllMocks()
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
  alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
  nav.params = { courseId: 'c1', moduleId: 'm1' }
  admin.getModulesForCourse.mockResolvedValue([{ id: 'm2', title: 'Optics' }, { id: 'm1', title: 'Waves' }])
  admin.getVideosForModule.mockResolvedValue(videos as any)
  admin.getMaterials.mockResolvedValue(materials as any)
})
afterEach(() => {
  confirmSpy.mockRestore()
  alertSpy.mockRestore()
})

const renderPage = async (store = withCourse()) => {
  const view = renderWithStore(<ModuleContentPage />, { store })
  await screen.findByRole('heading', { name: 'Manage Videos & Materials' })
  return view
}
const videoCard = (title: string) => within(screen.getByRole('heading', { name: title }).closest('.rounded-xl') as HTMLElement)
const materialRow = (title: string) => screen.getByText(title).closest('.rounded-lg') as HTMLElement
const loads = () => admin.getVideosForModule.mock.calls.length

// ─────────────────────────────────────────────────────────────────────────────
describe('access and loading', () => {
  it('sends visitors to log in', () => {
    nav.pathname = '/admin/courses/c1/video-modules/m1/videos'
    renderWithStore(<ModuleContentPage />, { store: makeStore({ auth: { isInitialized: true } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fadmin%2Fcourses%2Fc1%2Fvideo-modules%2Fm1%2Fvideos')
  })

  it('fetches the user when signed in without one', () => {
    auth.getCurrentUser.mockReturnValue(new Promise(() => {}))
    renderWithStore(<ModuleContentPage />, { store: makeStore({ auth: { isAuthenticated: true, isInitialized: true } }) })
    expect(auth.getCurrentUser).toHaveBeenCalled()
    expect(screen.getByText('Loading manager...')).toBeInTheDocument()
  })

  it('sends students home', () => {
    renderWithStore(<ModuleContentPage />, { store: withCourse('student') })
    expect(nav.router.push).toHaveBeenCalledWith('/')
    expect(admin.getVideosForModule).not.toHaveBeenCalled()
  })

  it('loads the course list when the store is empty', async () => {
    admin.getCourses.mockResolvedValue([physics] as any)
    renderWithStore(<ModuleContentPage />, { store: asRole('super_admin') })
    expect(screen.getByText('Loading manager...')).toBeInTheDocument()
    expect(await screen.findByText('Lesson: Waves • Physics Videos')).toBeInTheDocument()
    expect(admin.getCourses).toHaveBeenCalled()
  })

  it('loads the lesson, its videos and materials', async () => {
    await renderPage()
    expect(admin.getModulesForCourse).toHaveBeenCalledWith('c1')
    expect(admin.getVideosForModule).toHaveBeenCalledWith('c1', 'm1')
    expect(admin.getMaterials).toHaveBeenCalledWith('c1', 'm1')
    expect(screen.getByText('Lesson: Waves • Physics Videos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Lessons' })).toHaveAttribute('href', '/admin/courses/c1/video-modules')
  })

  it('shows a failed load', async () => {
    admin.getVideosForModule.mockImplementation(() => httpError(500, { detail: 'Course service down' }))
    await renderPage()
    expect(screen.getByText('Course service down')).toBeInTheDocument()
  })

  it('handles an unknown lesson with no content', async () => {
    admin.getModulesForCourse.mockResolvedValue([{ id: 'm2', title: 'Optics' }])
    admin.getVideosForModule.mockResolvedValue([])
    admin.getMaterials.mockResolvedValue([])
    await renderPage()
    expect(screen.queryByText(/^Lesson:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Lesson Materials/)).not.toBeInTheDocument()
    expect(screen.getByText('No videos added yet. Click "+ Add Video" to get started.')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('content list', () => {
  it('shows lesson-level materials', async () => {
    await renderPage()
    expect(screen.getByText('Lesson Materials (1)')).toBeInTheDocument()
    expect(within(materialRow('Syllabus')).getByRole('link', { name: 'Download' })).toHaveAttribute('href', 'https://files/mat3.pdf')
  })

  it('shows videos in order with their details and materials', async () => {
    await renderPage()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Intro', 'Interference'])

    const intro = videoCard('Intro')
    expect(intro.getByText('Start here')).toBeInTheDocument()
    expect(intro.getByText('ORDER: 1')).toBeInTheDocument()
    expect(intro.getByText('10m 0s')).toBeInTheDocument()
    expect(intro.getByText('Published')).toBeInTheDocument()
    expect(intro.getByRole('img', { name: 'Thumbnail' })).toHaveAttribute('src', 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
    expect(intro.getByText('Materials (2)')).toBeInTheDocument()
    expect(intro.getAllByText(/^(Slides|Notes)$/).map((e) => e.textContent)).toEqual(['Slides', 'Notes'])

    const interference = videoCard('Interference')
    expect(interference.getByText('2m 5s')).toBeInTheDocument()
    expect(interference.getByText('Draft')).toBeInTheDocument()
    expect(interference.getByText('https://youtu.be/abcdefghijk')).toBeInTheDocument()
    expect(interference.getByRole('img', { name: 'Thumbnail' })).toHaveAttribute('src', 'https://img.youtube.com/vi/abcdefghijk/mqdefault.jpg')
    expect(interference.getByText('Materials (0)')).toBeInTheDocument()
    expect(interference.getByText('No materials for this video yet')).toBeInTheDocument()
  })

  it.each([
    ['https://www.youtube.com/watch?v=AAAAAAAAAAA&t=4', 'AAAAAAAAAAA'],
    ['youtube.com/shorts/BBBBBBBBBBB', 'BBBBBBBBBBB'],
    ['https://m.youtube.com/embed/CCCCCCCCCCC?rel=0', 'CCCCCCCCCCC'],
    ['https://www.youtube.com/live/DDDDDDDDDDD', 'DDDDDDDDDDD'],
    ['https://www.youtube.com/watch', ''],
    ['https://www.youtube.com/channel/xyz', 'https://www.youtube.com/channel/xyz'],
    ['https://vimeo.com/42', 'https://vimeo.com/42'],
    ['http://[broken', 'http://[broken'],
    ['', ''],
  ])('reads the YouTube id from %p', async (url, id) => {
    admin.getVideosForModule.mockResolvedValue([video('v1', { title: 'Intro', yt_video_id: url })] as any)
    await renderPage()
    expect(screen.getByRole('img', { name: 'Thumbnail' })).toHaveAttribute('src', `https://img.youtube.com/vi/${id}/mqdefault.jpg`)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('videos', () => {
  const spin = () => screen.getAllByRole('spinbutton')

  it('adds a video from a YouTube URL', async () => {
    admin.createVideoForModule.mockResolvedValue({} as any)
    await renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Video' }))
    expect(screen.getByRole('heading', { name: 'Add New Video' })).toBeInTheDocument()
    expect(spin()[2]).toHaveValue(3)
    await userEvent.type(screen.getByPlaceholderText('e.g. Lesson 01 - Basics of UI Design'), 'Diffraction')
    await userEvent.type(screen.getByPlaceholderText(/youtu.be/), ' https://www.youtube.com/watch?v=dQw4w9WgXcQ ')
    await userEvent.clear(spin()[0])
    await userEvent.type(spin()[0], '5')
    await userEvent.clear(spin()[1])
    await userEvent.type(spin()[1], '30')
    await userEvent.type(screen.getByPlaceholderText('Brief summary of the lesson...'), 'Slits')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Publish immediately' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add Video' }))

    expect(admin.createVideoForModule).toHaveBeenCalledWith('c1', {
      module_id: 'm1', title: 'Diffraction', description: 'Slits', yt_video_id: 'dQw4w9WgXcQ',
      duration_seconds: 330, order_number: 3, is_published: false,
    })
    await waitFor(() => expect(loads()).toBe(2))
    expect(screen.queryByRole('heading', { name: 'Add New Video' })).not.toBeInTheDocument()
  })

  it('treats blank numbers as zero', async () => {
    admin.createVideoForModule.mockResolvedValue({} as any)
    await renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Video' }))
    await userEvent.type(screen.getByPlaceholderText('e.g. Lesson 01 - Basics of UI Design'), 'Short')
    await userEvent.type(screen.getByPlaceholderText(/youtu.be/), 'dQw4w9WgXcQ')
    spin().forEach((s) => fireEvent.change(s, { target: { value: '' } }))
    await userEvent.click(screen.getByRole('button', { name: 'Add Video' }))
    expect(admin.createVideoForModule).toHaveBeenCalledWith('c1', expect.objectContaining({ duration_seconds: 0, order_number: 0, is_published: true }))
  })

  it('edits a video', async () => {
    admin.updateVideoForModule.mockResolvedValue({} as any)
    await renderPage()
    await userEvent.click(videoCard('Interference').getByTitle('Edit Video'))
    expect(screen.getByRole('heading', { name: 'Edit Video Lesson' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Interference')).toBeInTheDocument()
    expect(spin().map((s) => (s as HTMLInputElement).value)).toEqual(['2', '5', '2'])
    expect(screen.getByRole('checkbox', { name: 'Publish immediately' })).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Update Video' }))
    expect(admin.updateVideoForModule).toHaveBeenCalledWith('c1', 'm1', 'v2', {
      module_id: 'm1', title: 'Interference', description: '', yt_video_id: 'abcdefghijk',
      duration_seconds: 125, order_number: 2, is_published: false,
    })
    await waitFor(() => expect(loads()).toBe(2))
  })

  it('opens a video without a stored duration', async () => {
    admin.getVideosForModule.mockResolvedValue([video('v1', { title: 'Intro', duration_seconds: null, description: null })] as any)
    await renderPage()
    await userEvent.click(screen.getByTitle('Edit Video'))
    expect(spin()[0]).toHaveValue(0)
    expect(spin()[1]).toHaveValue(0)
  })

  it('shows a failed save and closes', async () => {
    admin.createVideoForModule.mockImplementation(() => httpError(400, { detail: 'Invalid video id' }))
    await renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Video' }))
    await userEvent.type(screen.getByPlaceholderText('e.g. Lesson 01 - Basics of UI Design'), 'Bad')
    await userEvent.type(screen.getByPlaceholderText(/youtu.be/), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Add Video' }))
    expect((await screen.findAllByText('Invalid video id')).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'Add New Video' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Video' }))
    expect(screen.queryByText('Invalid video id')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(screen.queryByRole('heading', { name: 'Add New Video' })).not.toBeInTheDocument()
  })

  it('deletes a video only after confirming', async () => {
    admin.deleteVideoForModule.mockResolvedValue(undefined as any)
    confirmSpy.mockReturnValueOnce(false)
    await renderPage()
    await userEvent.click(videoCard('Intro').getByTitle('Delete Video'))
    expect(confirmSpy).toHaveBeenCalledWith('Delete video "Intro"?')
    expect(admin.deleteVideoForModule).not.toHaveBeenCalled()
    await userEvent.click(videoCard('Intro').getByTitle('Delete Video'))
    expect(admin.deleteVideoForModule).toHaveBeenCalledWith('c1', 'm1', 'v1')
    await waitFor(() => expect(loads()).toBe(2))
  })

  it('alerts when a delete fails', async () => {
    admin.deleteVideoForModule.mockImplementation(() => httpError(409, { detail: 'Video has progress' }))
    await renderPage()
    await userEvent.click(videoCard('Intro').getByTitle('Delete Video'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Video has progress'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('materials', () => {
  const pdf = (name = 'notes.pdf') => new File(['%PDF'], name, { type: 'application/pdf' })
  const fileInput = () => document.getElementById('file-upload') as HTMLInputElement
  const nameBox = () => screen.getByPlaceholderText('e.g. Lecture Notes - PDF')
  const uploaded = { file_url: 'https://files/new.pdf', file_public_id: 'pid-new', file_type: 'pdf' }

  it('needs a file for a new material', async () => {
    await renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Lesson Material' }))
    expect(screen.getByRole('heading', { name: 'Add New Material' })).toBeInTheDocument()
    await userEvent.type(nameBox(), 'Worksheet')
    await userEvent.click(screen.getByRole('button', { name: 'Add Material' }))
    expect((await screen.findAllByText('Please select a file')).length).toBeGreaterThan(0)
    expect(admin.uploadFile).not.toHaveBeenCalled()
  })

  it('adds a lesson-level material', async () => {
    admin.uploadFile.mockResolvedValue(uploaded as any)
    admin.createMaterial.mockResolvedValue({} as any)
    await renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Lesson Material' }))
    await userEvent.type(nameBox(), 'Worksheet')
    await userEvent.upload(fileInput(), pdf())
    expect(screen.getByText('Selected: notes.pdf')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('spinbutton'), '4')
    await userEvent.click(screen.getByRole('button', { name: 'Add Material' }))

    expect(admin.uploadFile).toHaveBeenCalledWith(expect.any(File))
    await waitFor(() => expect(admin.createMaterial).toHaveBeenCalledWith('c1', {
      module_id: 'm1', video_id: null, title: 'Worksheet', file_url: 'https://files/new.pdf', file_type: 'pdf', file_public_id: 'pid-new', order_number: 4,
    }))
    await waitFor(() => expect(loads()).toBe(2))
    expect(screen.queryByRole('heading', { name: 'Add New Material' })).not.toBeInTheDocument()
  })

  it('adds a material to a video', async () => {
    admin.uploadFile.mockResolvedValue({ ...uploaded, file_public_id: '' } as any)
    admin.createMaterial.mockResolvedValue({} as any)
    await renderPage()
    await userEvent.click(videoCard('Interference').getByRole('button', { name: '+ Add Material' }))
    await userEvent.type(nameBox(), 'Diagram')
    await userEvent.upload(fileInput(), pdf())
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add Material' }))
    await waitFor(() => expect(admin.createMaterial).toHaveBeenCalledWith('c1', expect.objectContaining({ video_id: 'v2', file_public_id: null, order_number: 0 })))
  })

  it('edits a material and keeps its file', async () => {
    admin.updateMaterial.mockResolvedValue({} as any)
    await renderPage()
    await userEvent.click(within(materialRow('Slides')).getAllByRole('button')[0])
    expect(screen.getByRole('heading', { name: 'Edit Material' })).toBeInTheDocument()
    expect(nameBox()).toHaveValue('Slides')
    expect(screen.getByText('Keep empty to use existing file')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(admin.uploadFile).not.toHaveBeenCalled()
    expect(admin.updateMaterial).toHaveBeenCalledWith('c1', 'm1', 'mat2', {
      module_id: 'm1', video_id: 'v1', title: 'Slides', file_url: 'https://files/mat2.pdf', file_type: 'pdf', file_public_id: 'pid-mat2', order_number: 1,
    })
    await waitFor(() => expect(loads()).toBe(2))
    expect(admin.deleteImage).not.toHaveBeenCalled()
  })

  it('replaces a material file and removes the old one, ignoring cleanup errors', async () => {
    admin.uploadFile.mockResolvedValue(uploaded as any)
    admin.updateMaterial.mockResolvedValue({} as any)
    admin.deleteImage.mockRejectedValue(new Error('gone'))
    await renderPage()
    await userEvent.click(within(materialRow('Slides')).getAllByRole('button')[0])
    await userEvent.upload(fileInput(), pdf('slides-v2.pdf'))
    expect(screen.queryByText('Keep empty to use existing file')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(admin.updateMaterial).toHaveBeenCalledWith('c1', 'm1', 'mat2', expect.objectContaining({ file_url: 'https://files/new.pdf', file_public_id: 'pid-new' })))
    expect(admin.deleteImage).toHaveBeenCalledWith('pid-mat2')
    await waitFor(() => expect(loads()).toBe(2))
  })

  it('edits a lesson-level material without a stored public id or type', async () => {
    admin.getMaterials.mockResolvedValue([material('mat3', { title: 'Syllabus', file_type: null })] as any)
    admin.uploadFile.mockResolvedValue(uploaded as any)
    admin.updateMaterial.mockResolvedValue({} as any)
    await renderPage()
    await userEvent.click(within(materialRow('Syllabus')).getByRole('button', { name: 'Edit' }))
    await userEvent.upload(fileInput(), pdf())
    await userEvent.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(admin.updateMaterial).toHaveBeenCalledWith('c1', 'm1', 'mat3', expect.objectContaining({ video_id: null })))
    expect(admin.deleteImage).not.toHaveBeenCalled()
  })

  it('shows a failed save and closes', async () => {
    admin.uploadFile.mockImplementation(() => httpError(413, { detail: 'File too large' }))
    await renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Lesson Material' }))
    await userEvent.type(nameBox(), 'Big')
    await userEvent.upload(fileInput(), pdf())
    await userEvent.click(screen.getByRole('button', { name: 'Add Material' }))
    expect((await screen.findAllByText('File too large')).length).toBeGreaterThan(0)
    expect(admin.createMaterial).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'Add New Material' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Lesson Material' }))
    await userEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(screen.queryByRole('heading', { name: 'Add New Material' })).not.toBeInTheDocument()
  })

  it('deletes a material and its file after confirming', async () => {
    admin.deleteMaterial.mockResolvedValue(undefined as any)
    admin.deleteImage.mockRejectedValue(new Error('gone'))
    confirmSpy.mockReturnValueOnce(false)
    await renderPage()
    await userEvent.click(within(materialRow('Slides')).getAllByRole('button')[1])
    expect(confirmSpy).toHaveBeenCalledWith('Delete material "Slides"?')
    expect(admin.deleteMaterial).not.toHaveBeenCalled()
    await userEvent.click(within(materialRow('Slides')).getAllByRole('button')[1])
    expect(admin.deleteMaterial).toHaveBeenCalledWith('c1', 'm1', 'mat2')
    await waitFor(() => expect(admin.deleteImage).toHaveBeenCalledWith('pid-mat2'))
    await waitFor(() => expect(loads()).toBe(2))
  })

  it('deletes a lesson-level material without a stored file id', async () => {
    admin.deleteMaterial.mockResolvedValue(undefined as any)
    await renderPage()
    await userEvent.click(within(materialRow('Syllabus')).getByRole('button', { name: 'Delete' }))
    expect(admin.deleteMaterial).toHaveBeenCalledWith('c1', 'm1', 'mat3')
    await waitFor(() => expect(loads()).toBe(2))
    expect(admin.deleteImage).not.toHaveBeenCalled()
  })

  it('alerts when a delete fails', async () => {
    admin.deleteMaterial.mockImplementation(() => httpError(500, { detail: 'Storage error' }))
    await renderPage()
    await userEvent.click(within(materialRow('Syllabus')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Storage error'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('video quizzes', () => {
  const checkpoints = [
    {
      id: 'cp1', timestamp_seconds: 65,
      questions: [{ id: 'q1', question_text: 'What is a wave?', option_a: 'A disturbance', option_b: 'A particle', option_c: '', option_d: '', option_e: '', correct_option: 'b', explanation: 'Energy transfer' }],
    },
    { id: 'cp2', timestamp_seconds: 600, questions: [] },
  ]
  const csv = () => new File(['timestamp,question'], 'quiz.csv', { type: 'text/csv' })
  const modal = () => within(screen.getByRole('heading', { name: 'Manage Video Quizzes' }).closest('.rounded-2xl') as HTMLElement)
  const openQuiz = async (title = 'Intro') => {
    await renderPage()
    await userEvent.click(videoCard(title).getByRole('button', { name: 'Manage Quiz' }))
  }

  beforeEach(() => {
    admin.getVideoCheckpoints.mockResolvedValue(checkpoints as any)
  })

  it('lists the checkpoints for a video', async () => {
    let finish!: (v: any) => void
    admin.getVideoCheckpoints.mockReturnValue(new Promise((r) => { finish = r }))
    await openQuiz()
    expect(admin.getVideoCheckpoints).toHaveBeenCalledWith('c1', 'm1', 'v1')
    expect(modal().getByText('Updating list...')).toBeInTheDocument()
    finish(checkpoints)
    expect(await modal().findByText('What is a wave?')).toBeInTheDocument()
    expect(modal().getByText('Current Quizzes (2)')).toBeInTheDocument()
    expect(modal().getByText('1:05')).toBeInTheDocument()
    expect(modal().getByText('1 Question(s)')).toBeInTheDocument()
    expect(modal().getByText('10:00')).toBeInTheDocument()
    expect(modal().getByText('Checkpoint')).toBeInTheDocument()
    expect(modal().getByText('0 Question(s)')).toBeInTheDocument()
  })

  it('shows an empty video and logs failed loads', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    admin.getVideoCheckpoints.mockImplementation(() => httpError(500))
    await openQuiz()
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to load checkpoints', expect.any(Error)))
    expect(modal().getByText('No quizzes added to this video yet.')).toBeInTheDocument()
    expect(modal().queryByRole('button', { name: 'Clear All' })).not.toBeInTheDocument()
    errorSpy.mockRestore()
  })

  it('downloads the CSV template and reports failures', async () => {
    admin.downloadCheckpointCSVTemplate.mockResolvedValueOnce(undefined as any).mockRejectedValueOnce(new Error('offline'))
    await openQuiz()
    await userEvent.click(modal().getByRole('button', { name: 'Get CSV Template' }))
    expect(admin.downloadCheckpointCSVTemplate).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Could not download the template')).not.toBeInTheDocument()
    await userEvent.click(modal().getByRole('button', { name: 'Get CSV Template' }))
    expect(await screen.findByText('Could not download the template')).toBeInTheDocument()
  })

  it('imports a CSV on top of existing quizzes', async () => {
    admin.importVideoCheckpointsCSV.mockResolvedValue({ message: 'Imported 3', questions_created: 3, errors: [] })
    await openQuiz()
    await modal().findByText('What is a wave?')
    expect(modal().getByText('Choose file...')).toBeInTheDocument()
    await userEvent.upload(document.querySelector('input[accept=".csv"]') as HTMLInputElement, csv())
    expect(modal().getByText('quiz.csv')).toBeInTheDocument()
    expect(modal().getByText(/This will ADD these questions/)).toBeInTheDocument()
    await userEvent.click(modal().getByRole('button', { name: 'Overlay New CSV' }))
    expect(admin.importVideoCheckpointsCSV).toHaveBeenCalledWith('c1', 'm1', 'v1', expect.any(File))
    await waitFor(() => expect(admin.getVideoCheckpoints).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(loads()).toBe(2))
    expect(modal().getByText('Choose file...')).toBeInTheDocument()
  })

  // BUG: after an import, loadData() swaps the page for "Loading manager..."
  // and then clears localError, so the skipped-rows warning is never seen.
  test.failing('imports into an empty video and reports skipped rows', async () => {
    admin.getVideoCheckpoints.mockResolvedValue([])
    admin.importVideoCheckpointsCSV.mockResolvedValue({ message: 'Imported 1', questions_created: 1, errors: ['Row 2: bad time', 'Row 4: no answer'] })
    await openQuiz('Interference')
    await modal().findByText('No quizzes added to this video yet.')
    await userEvent.upload(document.querySelector('input[accept=".csv"]') as HTMLInputElement, csv())
    await userEvent.click(modal().getByRole('button', { name: 'Import' }))
    expect(admin.importVideoCheckpointsCSV).toHaveBeenCalledWith('c1', 'm1', 'v2', expect.any(File))
    await waitFor(() => expect(loads()).toBe(2))
    expect(await screen.findByText('Imported 1. Skipped: Row 2: bad time; Row 4: no answer')).toBeInTheDocument()
  })

  it('shows a failed import', async () => {
    admin.importVideoCheckpointsCSV.mockImplementation(() => httpError(400, { detail: 'Bad CSV header' }))
    await openQuiz()
    await userEvent.upload(document.querySelector('input[accept=".csv"]') as HTMLInputElement, csv())
    await userEvent.click(modal().getByRole('button', { name: 'Overlay New CSV' }))
    expect(await screen.findByText('Bad CSV header')).toBeInTheDocument()
  })

  it('edits a checkpoint question and timing', async () => {
    admin.updateVideoCheckpoint.mockResolvedValue({} as any)
    admin.updateCheckpointQuestion.mockResolvedValue({} as any)
    await openQuiz()
    await userEvent.click((await modal().findAllByTitle('Edit'))[0])

    const [mm, ss] = modal().getAllByRole('spinbutton')
    expect(mm).toHaveValue(1)
    expect(ss).toHaveValue(5)
    const boxes = modal().getAllByRole('textbox') as HTMLInputElement[]
    expect(boxes.map((b) => b.value)).toEqual(['What is a wave?', 'A disturbance', 'A particle', '', '', '', 'Energy transfer'])
    expect(modal().getByRole('combobox')).toHaveValue('b')

    await userEvent.clear(mm)
    await userEvent.type(mm, '2')
    await userEvent.type(boxes[3], 'A field')
    await userEvent.selectOptions(modal().getByRole('combobox'), 'c')
    await userEvent.clear(boxes[6])
    await userEvent.type(boxes[6], 'Updated')
    await userEvent.click(modal().getByRole('button', { name: 'Save Changes' }))

    expect(admin.updateVideoCheckpoint).toHaveBeenCalledWith('cp1', { timestamp_seconds: 125 })
    await waitFor(() => expect(admin.updateCheckpointQuestion).toHaveBeenCalledWith('q1', {
      question_text: 'What is a wave?', option_a: 'A disturbance', option_b: 'A particle', option_c: 'A field',
      option_d: '', option_e: '', correct_option: 'c', explanation: 'Updated',
    }))
    expect(await modal().findByText('Current Quizzes (2)')).toBeInTheDocument()
    expect(admin.getVideoCheckpoints).toHaveBeenCalledTimes(2)
  })

  it('updates timing only for a checkpoint without a question', async () => {
    admin.updateVideoCheckpoint.mockResolvedValue({} as any)
    await openQuiz()
    await userEvent.click((await modal().findAllByTitle('Edit'))[1])
    expect(modal().getByRole('combobox')).toHaveValue('a')
    const boxes = modal().getAllByRole('textbox')
    await userEvent.type(boxes[0], 'Placeholder')
    await userEvent.type(boxes[1], 'x')
    await userEvent.type(boxes[2], 'y')
    const [mm, ss] = modal().getAllByRole('spinbutton')
    fireEvent.change(mm, { target: { value: '' } })
    fireEvent.change(ss, { target: { value: '' } })
    fireEvent.submit(mm.closest('form')!)
    await waitFor(() => expect(admin.updateVideoCheckpoint).toHaveBeenCalledWith('cp2', { timestamp_seconds: 0 }))
    expect(admin.updateCheckpointQuestion).not.toHaveBeenCalled()
  })

  it('shows a failed checkpoint save and goes back to the list', async () => {
    admin.updateVideoCheckpoint.mockImplementation(() => httpError(400, { detail: 'Past video end' }))
    await openQuiz()
    await userEvent.click((await modal().findAllByTitle('Edit'))[0])
    await userEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Past video end')).toBeInTheDocument()
    await userEvent.click(modal().getByRole('button', { name: 'Back to List' }))
    expect(modal().getByText('Current Quizzes (2)')).toBeInTheDocument()
  })

  it('leaves edit mode when the manager closes', async () => {
    await openQuiz()
    await userEvent.click((await modal().findAllByTitle('Edit'))[0])
    expect(modal().getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    await userEvent.click(modal().getByRole('button', { name: '✕' }))
    expect(screen.queryByRole('heading', { name: 'Manage Video Quizzes' })).not.toBeInTheDocument()
    await userEvent.click(videoCard('Intro').getByRole('button', { name: 'Manage Quiz' }))
    expect(await modal().findByText('Current Quizzes (2)')).toBeInTheDocument()
    await userEvent.click(modal().getByRole('button', { name: 'Close Manager' }))
    expect(screen.queryByRole('heading', { name: 'Manage Video Quizzes' })).not.toBeInTheDocument()
  })

  it('deletes a checkpoint after confirming', async () => {
    admin.deleteVideoCheckpoint.mockResolvedValue(undefined as any)
    confirmSpy.mockReturnValueOnce(false)
    await openQuiz()
    const del = (await modal().findAllByTitle('Delete'))[0]
    await userEvent.click(del)
    expect(confirmSpy).toHaveBeenCalledWith('Delete this quiz checkpoint?')
    expect(admin.deleteVideoCheckpoint).not.toHaveBeenCalled()
    await userEvent.click(del)
    expect(admin.deleteVideoCheckpoint).toHaveBeenCalledWith('cp1')
    await waitFor(() => expect(admin.getVideoCheckpoints).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(loads()).toBe(2))
  })

  it('alerts when a checkpoint delete fails', async () => {
    admin.deleteVideoCheckpoint.mockImplementation(() => httpError(500, { detail: 'Locked' }))
    await openQuiz()
    await userEvent.click((await modal().findAllByTitle('Delete'))[0])
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Locked'))
  })

  it('clears every checkpoint after confirming', async () => {
    admin.clearVideoCheckpoints.mockResolvedValue(undefined as any)
    confirmSpy.mockReturnValueOnce(false)
    await openQuiz()
    const clear = await modal().findByRole('button', { name: 'Clear All' })
    await userEvent.click(clear)
    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete ALL quizzes for this video? This cannot be undone.')
    expect(admin.clearVideoCheckpoints).not.toHaveBeenCalled()
    await userEvent.click(clear)
    expect(admin.clearVideoCheckpoints).toHaveBeenCalledWith('c1', 'm1', 'v1')
    await waitFor(() => expect(admin.getVideoCheckpoints).toHaveBeenCalledTimes(2))
  })

  it('alerts when clearing fails', async () => {
    admin.clearVideoCheckpoints.mockImplementation(() => httpError(500, { detail: 'Clear blocked' }))
    await openQuiz()
    await userEvent.click(await modal().findByRole('button', { name: 'Clear All' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Clear blocked'))
  })
})
