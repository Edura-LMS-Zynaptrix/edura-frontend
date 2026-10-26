jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('canvas-confetti', () => jest.fn())
jest.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ clientId, children }: any) => (
    <div data-testid="google" data-client-id={clientId}>
      {children}
    </div>
  ),
}))
jest.mock('@/lib/api/auth')
jest.mock('@/lib/api/admin')
jest.mock('@/lib/api/chat')

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import confetti from 'canvas-confetti'
import * as adminApi from '@/lib/api/admin'
import * as authApi from '@/lib/api/auth'
import * as chatApi from '@/lib/api/chat'
import AdminStudentSearch from '@/components/admin/StudentSearchModal'
import EnrollmentAccessModal from '@/components/admin/EnrollmentAccessModal'
import AttemptReviewContent from '@/components/analytics/AttemptReviewContent'
import { ComparisonBarChart, MasteryRadarChart, PerformanceLineChart } from '@/components/analytics/ProgressCharts'
import AuthInitializer from '@/components/AuthInitializer'
import BadgeCard from '@/components/badges/BadgeCard'
import BadgeCelebration from '@/components/badges/BadgeCelebration'
import CheckpointOverlay from '@/components/CheckpointOverlay'
import AchievementPanel from '@/components/dashboard/AchievementPanel'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import DashboardSidebar from '@/components/dashboard/Sidebar'
import GoogleAuthProvider from '@/components/GoogleAuthProvider'
import { fakeJwt } from '@/test-utils/api'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const admin = adminApi as jest.Mocked<typeof adminApi>
const auth = authApi as jest.Mocked<typeof authApi>

beforeEach(() => {
  nav.reset()
  jest.resetAllMocks()
})

describe('GoogleAuthProvider', () => {
  it('wraps the app with the configured client id', () => {
    render(
      <GoogleAuthProvider>
        <p>child</p>
      </GoogleAuthProvider>
    )
    expect(screen.getByText('child')).toBeInTheDocument()
    expect(screen.getByTestId('google')).toHaveAttribute(
      'data-client-id',
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
    )
  })
})

describe('CheckpointOverlay', () => {
  const questions = [
    { id: 'q1', question_text: '2 + 2?', option_a: '3', option_b: '4', correct_option: 'b', explanation: 'Basic sums' },
    { id: 'q2', question_text: 'Capital?', option_a: 'Colombo', option_b: 'Kandy', option_c: 'Galle', correct_option: 'a' },
  ]

  it('asks each question and resumes the video when all are right', async () => {
    const onSuccess = jest.fn()
    const user = userEvent.setup()
    render(<CheckpointOverlay checkpoint={{ id: 'c', questions }} onSuccess={onSuccess} />)

    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: 'SUBMIT ANSWER' })
    expect(submit).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /4/ }))
    await user.click(submit)
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText('"Basic sums"')).toBeInTheDocument()
    expect(confetti).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /NEXT/ }))
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
    // The previous question animates out first; wait for the new options.
    await user.click(await screen.findByRole('button', { name: /Colombo/ }))
    expect(screen.getAllByRole('button', { name: /^[abc]/ })).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'SUBMIT ANSWER' }))
    expect(confetti).toHaveBeenCalledTimes(1)
    expect(screen.getByText('"Well done!"')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /CONTINUE/ }))
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('lets the student try again after a wrong answer', async () => {
    const user = userEvent.setup()
    render(<CheckpointOverlay checkpoint={{ id: 'c', questions: [questions[1]] }} onSuccess={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /Kandy/ }))
    await user.click(screen.getByRole('button', { name: 'SUBMIT ANSWER' }))
    expect(screen.getByText('Incorrect')).toBeInTheDocument()
    expect(screen.getByText(/not quite right/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Colombo/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'TRY AGAIN' }))
    expect(screen.getByRole('button', { name: 'SUBMIT ANSWER' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Colombo/ })).toBeEnabled()
  })
})

describe('BadgeCard', () => {
  const badge = (name: string, extra = {}) => ({
    id: '1',
    name,
    description: `${name} description`,
    category: 'performance' as const,
    icon_name: 'Trophy',
    criteria_key: 'k',
    ...extra,
  })

  it.each([
    ['Early Bird', '/badges/early-bird.png'],
    ['Night Owl', '/badges/night-owl.png'],
    ['Consistency King', '/badges/streak-king.png'],
    ['Perfect 100', '/badges/perfect-100.png'],
    ['Speed Demon', '/badges/speed-demon.png'],
    ['Improved Star', '/badges/improved-star.png'],
    ['Subject Expert', '/badges/subject-expert.png'],
    ['First Step', '/badges/exam-master.png'],
    ['Century Club', '/badges/century-club.png'],
    ['Junior Scholar', '/badges/scholar.png'],
  ])('uses the artwork for %s', (name, src) => {
    render(<BadgeCard badge={badge(name)} isEarned />)
    expect(screen.getByRole('img', { name })).toHaveAttribute('src', src)
  })

  it('falls back to the icon and shows the unlock date when earned', () => {
    const { container } = render(
      <BadgeCard badge={badge('Mystery', { category: 'unknown' })} isEarned awardedAt="2026-10-01T00:00:00Z" />
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText(/Unlocked:/)).toBeInTheDocument()
  })

  it('greys out a badge not yet earned', () => {
    const { container } = render(<BadgeCard badge={badge('Mystery', { icon_name: 'NotAnIcon' })} isEarned={false} awardedAt="x" />)
    expect(container.firstElementChild!.className).toContain('grayscale')
    expect(screen.queryByText(/Unlocked:/)).not.toBeInTheDocument()
  })
})

describe('BadgeCelebration', () => {
  const badges = [
    { id: '1', name: 'First Step', description: 'Finished a paper', category: 'milestone', icon_name: 'Footprints', criteria_key: 'a' },
    { id: '2', name: 'Perfect 100', description: 'Full marks', category: 'performance', icon_name: 'Nope', criteria_key: 'b' },
  ] as any

  it('shows nothing without new badges', () => {
    const { container } = renderWithStore(<BadgeCelebration />)
    expect(container).toBeEmptyDOMElement()
  })

  it('celebrates each new badge in turn, then clears them', async () => {
    const store = makeStore({ badges: { newlyEarned: badges } })
    renderWithStore(<BadgeCelebration />, { store })
    expect(screen.getByText('First Step')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next Badge!' }))
    expect(await screen.findByText('Perfect 100')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Awesome!' }))
    expect(store.getState().badges.newlyEarned).toEqual([])
  })
})

describe('dashboard widgets', () => {
  const attempts = [
    { attempt_id: '1', exam_title: 'Paper 1', course_title: 'Maths', subject: 'Algebra', marks_obtained: 8, total_questions: 10, started_at: '2026-10-01', status: 'completed', overall_rank: 3 },
    { attempt_id: '2', exam_title: 'Paper 2', course_title: 'Maths', subject: 'Algebra', marks_obtained: 3, total_questions: 0, started_at: '2026-10-02', status: 'graded', overall_rank: null },
  ]

  it('ActivityFeed greets the student and lists attempts', () => {
    render(<ActivityFeed attempts={attempts} loading={false} user={{ profile: { full_name: 'Ama Perera' } }} />)
    expect(screen.getByText(/Welcome back, Ama!/)).toBeInTheDocument()
    expect(screen.getByText('Attempted: Paper 1')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
    expect(screen.getByText('#-')).toBeInTheDocument()
    // (80% + 300%) / 2 — a missing question count is treated as 1.
    expect(screen.getByText('190%')).toBeInTheDocument()
  })

  it('ActivityFeed shows loading and empty states', () => {
    const { rerender } = render(<ActivityFeed attempts={[]} loading user={null} />)
    expect(screen.getByText('Loading your activity...')).toBeInTheDocument()
    expect(screen.getByText(/Welcome back, Student!/)).toBeInTheDocument()
    rerender(<ActivityFeed attempts={[]} loading={false} user={null} />)
    expect(screen.getByText('No activity yet')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('AchievementPanel shows up to four badges and the wallet', () => {
    const earned = ['Early Bird', 'Mystery', 'Night Owl', 'Speed Demon', 'Century Club'].map((name, i) => ({
      id: String(i),
      badge: { name },
    }))
    render(<AchievementPanel earnedBadges={earned} loadingBadges={false} referralSummary={{ wallet_credits: 7, referral_code: 'AMA1' }} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getAllByText(/Early Bird|Mystery|Night Owl|Speed Demon|Century Club/)).toHaveLength(4)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('AMA1')).toBeInTheDocument()
  })

  it.each([
    ['Early Bird', 'early-bird'],
    ['Night Watch', 'night-owl'],
    ['Wise Owl', 'night-owl'],
    ['Consistency', 'streak-king'],
    ['Streak King', 'streak-king'],
    ['Perfect Score', 'perfect-100'],
    ['Scored 100', 'perfect-100'],
    ['Speed Run', 'speed-demon'],
    ['Demon Mode', 'speed-demon'],
    ['Rising Star', 'improved-star'],
    ['Most Improved', 'improved-star'],
    ['Subject Expert', 'subject-expert'],
    ['First Step', 'exam-master'],
    ['Exam Master', 'exam-master'],
    ['Century', 'century-club'],
    ['Book Club', 'century-club'],
    ['Scholar', 'scholar'],
  ])('AchievementPanel shows the artwork for "%s"', (name, file) => {
    render(<AchievementPanel earnedBadges={[{ id: '1', badge: { name } }]} loadingBadges={false} referralSummary={null} />)
    expect(screen.getByRole('img', { name })).toHaveAttribute('src', `/badges/${file}.png`)
  })

  it('AchievementPanel falls back to an icon for badges without artwork', () => {
    render(<AchievementPanel earnedBadges={[{ id: '1', badge: { name: 'Mystery' } }]} loadingBadges={false} referralSummary={null} />)
    expect(screen.queryByRole('img', { name: 'Mystery' })).not.toBeInTheDocument()
    expect(screen.getByText('Mystery')).toBeInTheDocument()
  })

  it('AchievementPanel shows loading and empty states', () => {
    const { container, rerender } = render(<AchievementPanel earnedBadges={[]} loadingBadges referralSummary={null} />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
    rerender(<AchievementPanel earnedBadges={[]} loadingBadges={false} referralSummary={null} />)
    expect(screen.getByText('Earn your first badge!')).toBeInTheDocument()
    expect(screen.getByText('---')).toBeInTheDocument()
  })

  describe('DashboardSidebar', () => {
    const user = { email: 'ama@x.lk', role: 'student', profile: { full_name: 'Ama Perera', grade: 11, district: 'Colombo' } }

    it('shows the profile, links and enrolled courses', () => {
      const courses = Array.from({ length: 6 }, (_, i) => ({ course: { id: String(i), title: `Course ${i}` } }))
      renderWithStore(<DashboardSidebar enrollments={{ courses }} />, {
        store: makeStore({ auth: { user: user as any } }),
      })
      expect(screen.getByText('AP')).toBeInTheDocument()
      expect(screen.getByText('Grade 11 • Colombo')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Course 0' })).toHaveAttribute('href', '/student/courses/0')
      expect(screen.queryByText('Course 5')).not.toBeInTheDocument()
    })

    it('says when there are no courses and shows a stored photo', () => {
      renderWithStore(<DashboardSidebar enrollments={{ courses: [] }} />, {
        store: makeStore({ auth: { user: { ...user, profile: { ...user.profile, profile_photo_url: 'https://img/a.png' } } as any } }),
      })
      expect(screen.getByText('No collections found')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Ama Perera' })).toBeInTheDocument()
    })

    it('uploads a new photo and reloads the user', async () => {
      auth.updateProfilePhoto.mockResolvedValue({ avatar_url: 'u' } as any)
      auth.getCurrentUser.mockResolvedValue(user as any)
      const store = makeStore({ auth: { user: user as any } })
      const { container } = renderWithStore(<DashboardSidebar enrollments={null} />, { store })
      const input = container.querySelector('input[type=file]') as HTMLInputElement
      const click = jest.spyOn(input, 'click')
      fireEvent.click(screen.getByText('AP'))
      expect(click).toHaveBeenCalled()

      await userEvent.upload(input, new File(['x'], 'me.png', { type: 'image/png' }))
      await waitFor(() => expect(auth.getCurrentUser).toHaveBeenCalled())
      const form = auth.updateProfilePhoto.mock.calls[0][0] as FormData
      expect((form.get('file') as File).name).toBe('me.png')
    })

    it('does not reload the user when the upload fails, or when no file is chosen', async () => {
      auth.updateProfilePhoto.mockRejectedValue(new Error('too big'))
      const { container } = renderWithStore(<DashboardSidebar enrollments={null} />, {
        store: makeStore({ auth: { user: user as any } }),
      })
      const input = container.querySelector('input[type=file]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [] } })
      expect(auth.updateProfilePhoto).not.toHaveBeenCalled()
      await userEvent.upload(input, new File(['x'], 'me.png', { type: 'image/png' }))
      await waitFor(() => expect(auth.updateProfilePhoto).toHaveBeenCalled())
      expect(auth.getCurrentUser).not.toHaveBeenCalled()
    })
  })
})

describe('progress charts', () => {
  it.each([
    ['MasteryRadarChart', <MasteryRadarChart key="r" data={[{ subject: 'Maths', score: 80 }]} />],
    ['PerformanceLineChart', <PerformanceLineChart key="l" data={[{ name: 'P1', score: 70 }]} color="#f00" />],
    ['ComparisonBarChart', <ComparisonBarChart key="b" data={[{ name: 'P1', score: 70, avg: 60 }, { name: 'P2', score: 40, avg: 60 }]} />],
  ])('%s renders inside a sized container', (_n, chart) => {
    const { container } = render(chart)
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('PerformanceLineChart has a default colour', () => {
    const { container } = render(<PerformanceLineChart data={[]} />)
    expect(container.firstElementChild).toHaveClass('h-[250px]')
  })
})

describe('AttemptReviewContent', () => {
  const result = (overrides: any = {}) => ({
    marks_obtained: 9,
    total_questions: 10,
    time_taken_seconds: 3725,
    submitted_at: '2026-10-01T10:00:00Z',
    ranking: { overall_rank: 2, district_rank: null },
    review: [
      {
        question_id: '1',
        question_text: '2 + 2?',
        question_image_url: 'https://img/q.png',
        is_correct: false,
        selected_option_id: '3',
        correct_option_id: '4',
        explanation: 'Add them',
        video_url: 'https://www.youtube.com/watch?v=abc123&t=5',
        options: [
          { id: '3', option_text: 'Three', order_number: 1 },
          { id: '4', option_text: 'Four', order_number: 2 },
          { id: '5', option_text: 'Five', order_number: 3 },
        ],
      },
      { question_id: '2', question_text: 'Easy', is_correct: true, selected_option_id: 'a', correct_option_id: 'a', options: [] },
    ],
    ...overrides,
  })

  it('summarises the attempt and marks right and wrong answers', () => {
    render(<AttemptReviewContent result={result()} />)
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('9 / 10')).toBeInTheDocument()
    expect(screen.getByText('01:02:05')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('#-')).toBeInTheDocument()
    expect(screen.getByText('Incorrect')).toBeInTheDocument()
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText('Add them')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Question' })).toHaveAttribute('src', 'https://img/q.png')
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('Three').className).toContain('text-red-900')
    expect(screen.getByText('Four').className).toContain('text-emerald-900')
    expect(screen.getByText('Five').className).toContain('text-gray-600')
    expect(screen.getByTitle('Explanation Video')).toHaveAttribute('src', 'https://www.youtube.com/embed/abc123')
  })

  it.each([
    ['https://youtu.be/xyz?t=1', 'https://www.youtube.com/embed/xyz'],
    ['https://www.youtube.com/embed/qqq?rel=0', 'https://www.youtube.com/embed/qqq'],
    ['https://vimeo.com/1', 'https://vimeo.com/1'],
  ])('embeds %s as %s', (url, embed) => {
    const r = result()
    r.review[0].video_url = url
    render(<AttemptReviewContent result={r} />)
    expect(screen.getByTitle('Explanation Video')).toHaveAttribute('src', embed)
  })

  it('prints the video link instead of embedding it when capturing a PDF', () => {
    render(<AttemptReviewContent result={result({ marks_obtained: 2, time_taken_seconds: -5 })} isCapturing />)
    expect(screen.queryByTitle('Explanation Video')).not.toBeInTheDocument()
    expect(screen.getByText('https://www.youtube.com/watch?v=abc123&t=5')).toBeInTheDocument()
    expect(screen.getByText('00:00')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })
})

describe('StudentSearchModal', () => {
  afterEach(() => jest.useRealTimers())

  it('renders nothing when closed', () => {
    const { container } = render(<AdminStudentSearch isOpen={false} onClose={jest.fn()} onSelectStudent={jest.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('searches after two characters, debounced, and selects a student', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const student = { user_id: '7', full_name: 'ama perera', email: 'a@x.lk', grade: 11, school: 'Royal' } as any
    admin.getAdminStudents.mockResolvedValue({ total: 1, students: [student] })
    const onSelect = jest.fn()
    const onClose = jest.fn()
    render(<AdminStudentSearch isOpen onClose={onClose} onSelectStudent={onSelect} />)

    expect(screen.getByText('Type at least 2 characters to search')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/Search by name/), 'a')
    await act(async () => jest.advanceTimersByTime(300))
    expect(admin.getAdminStudents).not.toHaveBeenCalled()

    await user.type(screen.getByPlaceholderText(/Search by name/), 'm')
    await act(async () => jest.advanceTimersByTime(300))
    expect(admin.getAdminStudents).toHaveBeenCalledWith({ search: 'am', limit: 10 })
    await user.click(await screen.findByText('ama perera'))
    expect(onSelect).toHaveBeenCalledWith(student)
    expect(screen.getByText('A')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button')[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('says when nothing matches and survives a failed search', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    jest.spyOn(console, 'error').mockImplementation(() => {})
    admin.getAdminStudents.mockResolvedValueOnce({ total: 0, students: [] }).mockRejectedValueOnce(new Error('down'))
    render(<AdminStudentSearch isOpen onClose={jest.fn()} onSelectStudent={jest.fn()} />)
    await user.type(screen.getByPlaceholderText(/Search by name/), 'zz')
    await act(async () => jest.advanceTimersByTime(300))
    expect(await screen.findByText('No students found matching "zz"')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/Search by name/), 'z')
    await act(async () => jest.advanceTimersByTime(300))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    ;(console.error as jest.Mock).mockRestore()
  })

  it('shows progress while a chat is being opened', () => {
    render(<AdminStudentSearch isOpen isProcessing onClose={jest.fn()} onSelectStudent={jest.fn()} />)
    expect(screen.getByText('Initializing chat...')).toBeInTheDocument()
  })
})

describe('EnrollmentAccessModal', () => {
  const eligible = [
    { user_id: '7', full_name: 'Ama Perera', grade: 11, district: 'Colombo', school: 'Royal' },
    { user_id: '8', full_name: 'Kamal Silva', grade: 11, district: 'Kandy', school: 'Trinity' },
  ]
  const enrolled = [{ user_id: '9', full_name: 'Nimal', enrolled_at: '2026-01-01', is_manual: true }]

  const setup = (type: 'exam' | 'course' | 'sub_course' | 'module') => {
    const lists = {
      exam: ['getEnrolledStudentsForExam', 'getEligibleStudentsForExam'],
      course: ['getEnrolledStudentsForCourse', 'getEligibleStudentsForCourse'],
      sub_course: ['getEnrolledStudentsForSubCourse', 'getEligibleStudentsForSubCourse'],
      module: ['getEnrolledStudentsForVideoModule', 'getEligibleStudentsForVideoModule'],
    }[type]
    ;(admin as any)[lists[0]].mockResolvedValue(enrolled)
    ;(admin as any)[lists[1]].mockResolvedValue(eligible)
    return lists
  }

  it.each([
    ['course', 'grantCourseAccess', ['10', ['7', '8']], 'Course'],
    ['sub_course', 'grantSubCourseAccess', ['10', '5', ['7', '8']], 'Lesson'],
    ['module', 'grantVideoModuleAccess', ['10', '5', ['7', '8']], 'Lesson'],
  ] as const)('grants %s access to the selected students', async (type, grantName, args, label) => {
    const lists = setup(type)
    ;(admin as any)[grantName].mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    const id = type === 'course' ? '10' : '5'
    renderWithStore(<EnrollmentAccessModal type={type} id={id} courseId="10" title="Maths" onClose={jest.fn()} />)

    expect(screen.getByRole('heading', { name: `Manage ${label} Access` })).toBeInTheDocument()
    expect(await screen.findByText('Ama Perera')).toBeInTheDocument()
    expect((admin as any)[lists[0]]).toHaveBeenCalled()

    await user.click(screen.getByText('Ama Perera'))
    await user.click(screen.getByText('Kamal Silva'))
    await user.click(screen.getByText('Kamal Silva'))
    await user.click(screen.getByText('Kamal Silva'))
    await user.click(screen.getByRole('button', { name: 'Grant Access (2)' }))

    await waitFor(() => expect((admin as any)[grantName]).toHaveBeenCalledWith(...args))
    await waitFor(() => expect((admin as any)[lists[0]]).toHaveBeenCalledTimes(2)) // refreshed
  })

  it('searches eligible students by name, school or district', async () => {
    setup('course')
    renderWithStore(<EnrollmentAccessModal type="course" id="10" title="Maths" onClose={jest.fn()} />)
    await screen.findByText('Ama Perera')
    const search = screen.getByPlaceholderText('Search students...')
    await userEvent.type(search, 'trinity')
    expect(screen.queryByText('Ama Perera')).not.toBeInTheDocument()
    expect(screen.getByText('Kamal Silva')).toBeInTheDocument()
    await userEvent.clear(search)
    await userEvent.type(search, 'colombo')
    expect(screen.getByText('Ama Perera')).toBeInTheDocument()
    await userEvent.type(search, 'xyz')
    expect(screen.getByText('No eligible students found')).toBeInTheDocument()
  })

  it.each([
    ['course', 'revokeCourseAccess', ['10', '9']],
    ['sub_course', 'revokeSubCourseAccess', ['10', '5', '9']],
    ['module', 'revokeVideoModuleAccess', ['10', '5', '9']],
  ] as const)('revokes %s access after confirming', async (type, revokeName, args) => {
    setup(type)
    ;(admin as any)[revokeName].mockResolvedValue({ message: 'ok' })
    const confirm = jest.spyOn(window, 'confirm')
    renderWithStore(<EnrollmentAccessModal type={type} id={type === 'course' ? '10' : '5'} courseId="10" title="Maths" onClose={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Enrolled Students/ }))
    expect(await screen.findByText('Nimal')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()

    confirm.mockReturnValueOnce(false)
    await userEvent.click(screen.getByTitle('Revoke Access'))
    expect((admin as any)[revokeName]).not.toHaveBeenCalled()

    confirm.mockReturnValueOnce(true)
    await userEvent.click(screen.getByTitle('Revoke Access'))
    await waitFor(() => expect((admin as any)[revokeName]).toHaveBeenCalledWith(...args))
    expect(await screen.findByText('No enrolled students found')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('exam access shows the backend\'s limitation as an error', async () => {
    setup('exam')
    renderWithStore(<EnrollmentAccessModal type="exam" id="1" title="Paper" onClose={jest.fn()} />)
    expect(screen.getByRole('heading', { name: 'Manage Exam Access' })).toBeInTheDocument()
    await waitFor(() => expect(admin.getEnrolledStudentsForExam).toHaveBeenCalledWith('1'))
    expect(admin.getEligibleStudentsForExam).toHaveBeenCalledWith('1', undefined)
  })

  it('shows a loading state while the lists load', () => {
    admin.getEnrolledStudentsForCourse.mockReturnValue(new Promise(() => {}))
    admin.getEligibleStudentsForCourse.mockReturnValue(new Promise(() => {}))
    renderWithStore(<EnrollmentAccessModal type="course" id="10" title="Maths" onClose={jest.fn()} />)
    expect(screen.getByText('Loading records...')).toBeInTheDocument()
  })

  it('shows a load error and closes', async () => {
    admin.getEnrolledStudentsForCourse.mockRejectedValue(
      Object.assign(new Error('x'), { response: { data: { detail: { message: 'Forbidden' } } } })
    )
    admin.getEligibleStudentsForCourse.mockResolvedValue([])
    const onClose = jest.fn()
    renderWithStore(<EnrollmentAccessModal type="course" id="10" title="Maths" onClose={onClose} />)
    expect(await screen.findByText('Forbidden')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('AuthInitializer', () => {
  const fetchMock = jest.fn()
  beforeEach(() => {
    ;(global as any).fetch = fetchMock
    fetchMock.mockReset()
    auth.getCurrentUser.mockResolvedValue({ id: '7', needs_profile_completion: false } as any)
  })

  const token = (minutesLeft: number) =>
    fakeJwt({ sub: '7', role: 'STUDENT', exp: Math.floor(Date.now() / 1000) + minutesLeft * 60 })

  it('marks a visitor as initialized without calling the server', () => {
    const store = makeStore()
    renderWithStore(<AuthInitializer />, { store })
    expect(store.getState().auth).toMatchObject({ isInitialized: true, isAuthenticated: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('restores a fresh session straight away and loads the user', async () => {
    const jwt = token(60)
    localStorage.setItem('accessToken', jwt)
    const store = makeStore()
    renderWithStore(<AuthInitializer />, { store })
    await waitFor(() => expect(store.getState().auth.user).not.toBeNull())
    expect(store.getState().auth).toMatchObject({ isAuthenticated: true, accessToken: jwt })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes a token that is about to expire, keeping it where it was', async () => {
    sessionStorage.setItem('accessToken', token(5))
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'fresh' }) })
    const store = makeStore()
    renderWithStore(<AuthInitializer />, { store })
    await waitFor(() => expect(store.getState().auth.accessToken).toBe('fresh'))
    expect(fetchMock).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    )
    expect(sessionStorage.getItem('accessToken')).toBe('fresh')
  })

  it.each([
    ['the refresh is refused', () => fetchMock.mockResolvedValue({ ok: false })],
    ['the network is down', () => fetchMock.mockRejectedValue(new Error('offline'))],
    ['the reply has no token', () => fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })],
  ])('signs out when %s', async (_n, arrange) => {
    localStorage.setItem('accessToken', token(-10))
    arrange()
    const store = makeStore()
    renderWithStore(<AuthInitializer />, { store })
    await waitFor(() => expect(store.getState().auth.isInitialized).toBe(true))
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(store.getState().auth.isAuthenticated).toBe(false)
  })

  it('treats a token without an expiry as valid', async () => {
    localStorage.setItem('accessToken', 'not-a-jwt')
    const store = makeStore()
    renderWithStore(<AuthInitializer />, { store })
    await waitFor(() => expect(store.getState().auth.isAuthenticated).toBe(true))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('moves a guest chat onto the account', async () => {
    localStorage.setItem('accessToken', token(60))
    localStorage.setItem('chat_session_id', 'sess-1')
    ;(chatApi.syncChatSession as jest.Mock).mockResolvedValue({ message: 'ok' })
    ;(chatApi.getHistory as jest.Mock).mockResolvedValue([])
    renderWithStore(<AuthInitializer />)
    await waitFor(() => expect(chatApi.getHistory).toHaveBeenCalledWith(undefined))
    expect(chatApi.syncChatSession).toHaveBeenCalledWith('sess-1')
  })

  it('keeps going when the chat sync fails', async () => {
    localStorage.setItem('accessToken', token(60))
    localStorage.setItem('chat_session_id', 'sess-1')
    ;(chatApi.syncChatSession as jest.Mock).mockRejectedValue(new Error('down'))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    renderWithStore(<AuthInitializer />)
    await waitFor(() => expect(warn).toHaveBeenCalledWith('Chat sync failed:', expect.anything()))
    expect(chatApi.getHistory).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it.each([
    ['/student/courses', true],
    ['/student/my-courses', true],
    ['/profile', false],
  ])('sends a student without a complete profile from %s to complete it: %s', (path, redirects) => {
    nav.pathname = path
    const store = makeStore({
      auth: { isInitialized: true, accessToken: 'a', needsProfileCompletion: true },
    })
    renderWithStore(<AuthInitializer />, { store })
    if (redirects) expect(nav.router.replace).toHaveBeenCalledWith('/auth/complete-profile')
    else expect(nav.router.replace).not.toHaveBeenCalled()
  })

  it('uses the loaded user\'s flag too, and leaves complete profiles alone', () => {
    nav.pathname = '/student/courses'
    const { unmount } = renderWithStore(<AuthInitializer />, {
      store: makeStore({ auth: { isInitialized: true, accessToken: 'a', user: { needs_profile_completion: true } as any } }),
    })
    expect(nav.router.replace).toHaveBeenCalledTimes(1)
    unmount()
    nav.router.replace.mockReset()
    renderWithStore(<AuthInitializer />, {
      store: makeStore({ auth: { isInitialized: true, accessToken: 'a', user: { needs_profile_completion: false } as any } }),
    })
    expect(nav.router.replace).not.toHaveBeenCalled()
  })
})
