jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())
jest.mock('@/lib/api/student')
jest.mock('@/components/analytics/ProgressCharts', () => ({
  MasteryRadarChart: ({ data }: any) => <div data-testid="radar">{data.map((d: any) => `${d.subject}:${d.score}`).join(',')}</div>,
  PerformanceLineChart: ({ data }: any) => <div data-testid="trend">{data.map((d: any) => `${d.name}=${d.score}`).join(',')}</div>,
  ComparisonBarChart: () => null,
}))
jest.mock('@/components/analytics/AttemptReviewContent', () => ({
  __esModule: true,
  default: ({ isCapturing }: any) => (
    <div>
      <section data-pdf-section>answers</section>
      <section data-pdf-section>{isCapturing ? 'capturing' : 'summary'}</section>
    </div>
  ),
}))
const pdf = {
  setFillColor: jest.fn(), rect: jest.fn(), setTextColor: jest.fn(), setFontSize: jest.fn(), setFont: jest.fn(),
  text: jest.fn(), setDrawColor: jest.fn(), setLineWidth: jest.fn(), line: jest.fn(), addPage: jest.fn(),
  addImage: jest.fn(), save: jest.fn(),
}
jest.mock('html2canvas', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('jspdf', () => ({ jsPDF: jest.fn(() => pdf) }))

import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import html2canvas from 'html2canvas'
import * as studentApi from '@/lib/api/student'
import ResultsPage from '@/app/student/my-results/page'
import AttemptReviewPage from '@/app/student/my-results/attempt/[attemptId]/page'
import RankingsPage from '@/app/student/rankings/page'
import { clearNeedsProfileCompletion } from '@/lib/redux/slices/authSlice'
import { httpError } from '@/test-utils/api'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const student = studentApi as jest.Mocked<typeof studentApi>
const signedIn = (extra: any = {}) =>
  makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: '7', role: 'student' } as any }, ...extra })

beforeEach(() => {
  nav.reset()
  jest.clearAllMocks()
  jest.mocked(student.getMyAttempts).mockReset().mockResolvedValue([])
  jest.mocked(student.getMyProgress).mockReset()
  jest.mocked(student.fetchAttemptReview).mockReset()
  jest.mocked(student.getRankingExams).mockReset().mockResolvedValue([])
  jest.mocked(student.getRankingsLeaderboard).mockReset().mockResolvedValue([])
  jest.mocked(student.getExamRanking).mockReset()
})

describe('My results page', () => {
  const progress = {
    overall: { avg_score_pct: 72, total_attempts_made: 9, avg_time_seconds: 1500 },
    subjects: [
      {
        subject: 'Physics', course_title: 'A/L Physics', best_score_pct: 88, avg_score_pct: 70, avg_time_seconds: 1200,
        total_attempts_count: 5, score_trend: [50, 70, 88],
        exams: [{ title: 'Paper 1', attempts_count: 3, best_score_pct: 88 }],
      },
      {
        subject: 'Chemistry', course_title: 'A/L Chem', best_score_pct: 60, avg_score_pct: 55, avg_time_seconds: 1800,
        total_attempts_count: 4, score_trend: null, exams: [],
      },
    ],
  }
  const attempt = (id: string, extra: any = {}) => ({
    attempt_id: id, exam_id: 'e1', exam_title: 'Physics Paper 1', subject: 'Physics', course_title: 'A/L Physics',
    attempt_number: 1, marks_obtained: 45, total_questions: 50, time_taken_seconds: 1800,
    submitted_at: '2026-03-01T10:00:00Z', district_rank: 4, ...extra,
  })

  it('sends visitors to log in', () => {
    nav.pathname = '/student/my-results'
    renderWithStore(<ResultsPage />, { store: makeStore({ auth: { isInitialized: true } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fstudent%2Fmy-results')
  })

  it('loads attempts and progress, showing a spinner meanwhile', async () => {
    student.getMyProgress.mockReturnValue(new Promise(() => {}))
    const { container } = renderWithStore(<ResultsPage />, { store: signedIn() })
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    await waitFor(() => expect(student.getMyAttempts).toHaveBeenCalledWith(50))
    expect(student.getMyProgress).toHaveBeenCalled()
  })

  it('shows the analytics summary and subject cards', async () => {
    student.getMyProgress.mockResolvedValue(progress as any)
    renderWithStore(<ResultsPage />, { store: signedIn() })
    expect(await screen.findByText('72%')).toBeInTheDocument()
    expect(screen.getByText('Calculated across 9 diagnostic attempts.')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument() // 1500s ≈ 25 min/exam
    expect(screen.getByTestId('radar')).toHaveTextContent('Physics:88,Chemistry:60')
    expect(screen.getAllByTestId('trend')[0]).toHaveTextContent('Attempt 1=50,Attempt 2=70,Attempt 3=88')
    expect(screen.getAllByTestId('trend')[1]).toBeEmptyDOMElement()
    expect(screen.getByText('20m')).toBeInTheDocument()
  })

  it('drills into a subject and back out', async () => {
    student.getMyProgress.mockResolvedValue(progress as any)
    renderWithStore(<ResultsPage />, { store: signedIn() })
    await userEvent.click(await screen.findByRole('heading', { name: 'Physics' }))
    expect(screen.getByText('Diagnostic Exam List')).toBeInTheDocument()
    expect(screen.getByText('3 Attempts Made')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('heading', { name: 'Physics' }))
    expect(screen.queryByText('Diagnostic Exam List')).not.toBeInTheDocument()
  })

  it('groups raw attempts by exam and opens a review', async () => {
    student.getMyProgress.mockResolvedValue(progress as any)
    student.getMyAttempts.mockResolvedValue([
      attempt('a2', { attempt_number: 2, marks_obtained: 45 }),
      attempt('a1', { attempt_number: 1, marks_obtained: 20, submitted_at: null, district_rank: null }),
      attempt('b1', { exam_id: 'e2', exam_title: 'Chem Paper', marks_obtained: 10, total_questions: 0 }),
    ] as any)
    renderWithStore(<ResultsPage />, { store: signedIn() })
    await userEvent.click(await screen.findByRole('button', { name: /Recent Raw Data/ }))
    const physics = screen.getByText('Physics Paper 1').closest('.rounded-\\[2rem\\]') as HTMLElement
    expect(within(physics).getByText('45/50')).toHaveClass('text-emerald-600')
    expect(within(physics).getByText('Attempt #2')).toBeInTheDocument()
    expect(within(physics).getByText('Processing...')).toBeInTheDocument()
    expect(within(physics).getByText('40%')).toHaveClass('text-amber-600')
    expect(within(physics).getByText('#-')).toBeInTheDocument()
    const chem = screen.getByText('Chem Paper').closest('.rounded-\\[2rem\\]') as HTMLElement
    expect(within(chem).getByText('0%')).toBeInTheDocument() // no questions: avoids dividing by zero
    await userEvent.click(within(physics).getAllByRole('button', { name: /Review Paper/ })[0])
    expect(nav.router.push).toHaveBeenCalledWith('/student/my-results/attempt/a2')
  })

  it('shows an empty raw-data tab', async () => {
    student.getMyProgress.mockResolvedValue(progress as any)
    renderWithStore(<ResultsPage />, { store: signedIn() })
    await userEvent.click(await screen.findByRole('button', { name: /Recent Raw Data/ }))
    expect(screen.getByText('No diagnostic data detected yet.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Analytics/ }))
    expect(screen.getByText('Mastery Signature')).toBeInTheDocument()
  })
})

describe('Attempt review page', () => {
  const review = { marks_obtained: 18, total_questions: 20, ranking: { exam_title: 'Physics Paper 1', subject: 'Physics' } }

  beforeEach(() => {
    nav.params = { attemptId: 'att-9' }
  })

  it('loads the review for the attempt in the url', async () => {
    student.fetchAttemptReview.mockReturnValue(new Promise(() => {}))
    renderWithStore(<AttemptReviewPage />)
    expect(screen.getByText('Loading your submission...')).toBeInTheDocument()
    expect(student.fetchAttemptReview).toHaveBeenCalledWith('att-9')
  })

  it('shows the title, score and pass badge', async () => {
    student.fetchAttemptReview.mockResolvedValue(review)
    renderWithStore(<AttemptReviewPage />)
    expect(await screen.findByText('90% SCORE')).toHaveClass('text-emerald-700')
    expect(screen.getByRole('heading', { name: 'Physics Paper 1' })).toBeInTheDocument()
    expect(screen.getByText('answers')).toBeInTheDocument()
  })

  it('marks a score under 85% as not passed', async () => {
    student.fetchAttemptReview.mockResolvedValue({ ...review, marks_obtained: 10 })
    renderWithStore(<AttemptReviewPage />)
    expect(await screen.findByText('50% SCORE')).toHaveClass('text-red-700')
  })

  it('navigates back and to the results list', async () => {
    student.fetchAttemptReview.mockResolvedValue(review)
    renderWithStore(<AttemptReviewPage />)
    await userEvent.click(await screen.findByRole('button', { name: /Back to Journey/ }))
    expect(nav.router.back).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'DONE REVIEWING' }))
    expect(nav.router.push).toHaveBeenCalledWith('/student/my-results')
  })

  it('shows the error with a way back', async () => {
    student.fetchAttemptReview.mockImplementation(() => httpError(404, { detail: 'Attempt not found' }))
    renderWithStore(<AttemptReviewPage />)
    expect(await screen.findByText('Review Error')).toBeInTheDocument()
    expect(screen.getByText('Attempt not found')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Results' }))
    expect(nav.router.push).toHaveBeenCalledWith('/student/my-results')
  })

  it('does nothing without an attempt id', () => {
    nav.params = {}
    renderWithStore(<AttemptReviewPage />)
    expect(student.fetchAttemptReview).not.toHaveBeenCalled()
    expect(screen.getByText('Data is unavailable')).toBeInTheDocument()
  })

  it('captures each section into a paged A4 PDF', async () => {
    student.fetchAttemptReview.mockResolvedValue(review)
    // A tall first section forces the second onto a new page.
    jest.mocked(html2canvas)
      .mockResolvedValueOnce({ width: 100, height: 120, toDataURL: () => 'img-1' } as any)
      .mockResolvedValueOnce({ width: 100, height: 50, toDataURL: () => 'img-2' } as any)
    renderWithStore(<AttemptReviewPage />)
    await userEvent.click(await screen.findByRole('button', { name: /Download PDF/ }))
    expect(screen.getByRole('button', { name: /Generating/ })).toBeDisabled()
    await waitFor(() => expect(pdf.save).toHaveBeenCalledWith('exam-review-att-9.pdf'))
    expect(html2canvas).toHaveBeenCalledTimes(2)
    expect(pdf.addPage).toHaveBeenCalledTimes(1)
    expect(pdf.addImage.mock.calls.map((c) => c[0])).toEqual(['img-1', 'img-2'])
    expect(pdf.text).toHaveBeenCalledWith('Physics Paper 1', 10, 21)
    expect(pdf.text).toHaveBeenCalledWith('Score: 90% | 18/20', 200, 21, { align: 'right' })
    expect(pdf.text).toHaveBeenCalledWith('Page 2 / 2', 200, 282, { align: 'right' })
    expect(await screen.findByRole('button', { name: /Download PDF/ })).toBeEnabled()
  })

  it('shortens long titles in the PDF header', async () => {
    const title = 'A'.repeat(60)
    student.fetchAttemptReview.mockResolvedValue({ ...review, ranking: { exam_title: title, subject: 'X' } })
    jest.mocked(html2canvas).mockResolvedValue({ width: 100, height: 10, toDataURL: () => 'img' } as any)
    renderWithStore(<AttemptReviewPage />)
    await userEvent.click(await screen.findByRole('button', { name: /Download PDF/ }))
    await waitFor(() => expect(pdf.save).toHaveBeenCalled())
    expect(pdf.text).toHaveBeenCalledWith('A'.repeat(52) + '...', 10, 21)
    expect(pdf.addPage).not.toHaveBeenCalled()
  })
})

describe('Rankings page', () => {
  const exams = [
    { exam_id: 'e1', exam_title: 'Physics Paper 1', subject: 'Physics', course_title: 'A/L Physics' },
    { exam_id: 'e2', exam_title: 'Physics Paper 2', subject: 'Physics', course_title: 'A/L Physics' },
    { exam_id: 'e3', exam_title: 'Chem Paper 1', subject: 'Chemistry', course_title: 'A/L Chem' },
  ]
  const entry = (rank: number, extra: any = {}) => ({
    rank, full_name: `Student ${rank}`, school: `School ${rank}`, district: 'Colombo', district_rank: rank,
    grade: 13, score: 100 - rank * 10, time_taken_seconds: 65 * rank, is_current_user: false, ...extra,
  })

  it('shows an empty state when no exam has rankings', async () => {
    renderWithStore(<RankingsPage />)
    expect(await screen.findByText('No rankings yet')).toBeInTheDocument()
    expect(student.getRankingExams).toHaveBeenCalled()
  })

  it('asks for an exam, grouping exams by subject and course', async () => {
    student.getRankingExams.mockResolvedValue(exams as any)
    renderWithStore(<RankingsPage />)
    expect(await screen.findByText('Select an Exam')).toBeInTheDocument()
    const [group, exam] = screen.getAllByRole('combobox')
    expect(within(group).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All Courses', 'Chemistry - A/L Chem', 'Physics - A/L Physics',
    ])
    await userEvent.selectOptions(group, 'Physics - A/L Physics')
    expect(within(exam).getAllByRole('option').map((o) => o.textContent)).toEqual([
      '-- Select an Exam --', 'Physics Paper 1', 'Physics Paper 2',
    ])
  })

  it('loads the podium, the table and my rank for the chosen exam', async () => {
    student.getRankingExams.mockResolvedValue(exams as any)
    student.getRankingsLeaderboard.mockResolvedValue([1, 2, 3, 4, 5].map((r) => entry(r, { is_current_user: r === 5 })) as any)
    student.getExamRanking.mockResolvedValue({ overall_rank: 5, district_rank: null } as any)
    renderWithStore(<RankingsPage />, { store: signedIn() })
    await userEvent.selectOptions((await screen.findAllByRole('combobox'))[1], 'e1')
    expect(await screen.findByText('Student 1')).toBeInTheDocument()
    expect(student.getRankingsLeaderboard).toHaveBeenCalledWith('e1', '', 100, undefined)
    expect(student.getExamRanking).toHaveBeenCalledWith('e1')
    expect(screen.getByText('👑')).toBeInTheDocument()
    expect(screen.getByText('1m 5s')).toBeInTheDocument()
    expect(screen.getByText('Island Rank: #5')).toBeInTheDocument()
    expect(screen.getByText('District Rank: #—')).toBeInTheDocument()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2) // ranks 4 and 5
    expect(within(rows[1]).getByText('You')).toBeInTheDocument()
    expect(within(rows[1]).getByText('S')).toBeInTheDocument()
    expect(within(rows[0]).getByText('60%')).toHaveClass('text-yellow-600')
    expect(within(rows[1]).getByText('50%')).toHaveClass('text-yellow-600')
  })

  it('marks the current user on the podium', async () => {
    student.getRankingExams.mockResolvedValue(exams as any)
    student.getRankingsLeaderboard.mockResolvedValue([entry(1, { is_current_user: true, time_taken_seconds: 3700 }), entry(2), entry(3)] as any)
    renderWithStore(<RankingsPage />)
    await userEvent.selectOptions((await screen.findAllByRole('combobox'))[1], 'e1')
    expect(await screen.findByText('You')).toBeInTheDocument()
    expect(screen.getByText('1h 1m')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(student.getExamRanking).not.toHaveBeenCalled() // visitors have no rank
  })

  it('shows times under a minute in seconds only', async () => {
    student.getRankingExams.mockResolvedValue(exams as any)
    student.getRankingsLeaderboard.mockResolvedValue([entry(1, { time_taken_seconds: 45 }), entry(2), entry(3)] as any)
    renderWithStore(<RankingsPage />)
    await userEvent.selectOptions((await screen.findAllByRole('combobox'))[1], 'e1')
    expect(await screen.findByText('45s')).toBeInTheDocument()
    expect(screen.getByText('2m 10s')).toBeInTheDocument()
  })

  it('refetches for a district and clears filters', async () => {
    student.getRankingExams.mockResolvedValue(exams as any)
    renderWithStore(<RankingsPage />)
    const [, exam, district] = await screen.findAllByRole('combobox')
    await userEvent.selectOptions(exam, 'e3')
    expect(await screen.findByText('No Attempts Yet')).toBeInTheDocument()
    await userEvent.selectOptions(district, 'Kandy')
    await waitFor(() => expect(student.getRankingsLeaderboard).toHaveBeenLastCalledWith('e3', 'Kandy', 100, undefined))
    await userEvent.click(screen.getByRole('button', { name: /Clear filters/ }))
    expect(screen.getByText('Select an Exam')).toBeInTheDocument()
    expect(district).toHaveValue('')
  })

  it('shows placeholder rows while the board updates', async () => {
    student.getRankingExams.mockResolvedValue(exams as any)
    student.getRankingsLeaderboard.mockReturnValue(new Promise(() => {}))
    renderWithStore(<RankingsPage />)
    await userEvent.selectOptions((await screen.findAllByRole('combobox'))[1], 'e1')
    expect(screen.getByText('Updating live...')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(11)
  })

  it('renders nothing while the profile still needs completing', () => {
    const { container } = renderWithStore(<RankingsPage />, { store: makeStore({ auth: { needsProfileCompletion: true } }) })
    expect(container).toBeEmptyDOMElement()
  })

  // Bug: like CourseList, RankingsContent returns before its hooks run.
  test.failing('keeps working when profile completion finishes while mounted', async () => {
    const store = makeStore({ auth: { needsProfileCompletion: true } })
    renderWithStore(<RankingsPage />, { store })
    act(() => { store.dispatch(clearNeedsProfileCompletion()) })
    expect(await screen.findByText('No rankings yet')).toBeInTheDocument()
  })

  // Bug: examRank is never cleared, so after switching exams the banner keeps
  // the previous exam's rank under the new exam's title until (unless) the
  // new rank loads.
  test.failing('does not show the previous exam\'s rank for a new exam', async () => {
    student.getRankingExams.mockResolvedValue(exams as any)
    student.getExamRanking
      .mockResolvedValueOnce({ overall_rank: 2, district_rank: 1 } as any)
      .mockImplementationOnce(() => httpError(404, { detail: 'No attempt' }))
    renderWithStore(<RankingsPage />, { store: signedIn() })
    const exam = (await screen.findAllByRole('combobox'))[1]
    await userEvent.selectOptions(exam, 'e1')
    expect(await screen.findByText('Island Rank: #2')).toBeInTheDocument()
    await userEvent.selectOptions(exam, 'e2')
    await waitFor(() => expect(student.getExamRanking).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Island Rank: #2')).not.toBeInTheDocument()
  })
})
