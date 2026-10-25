jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())

import api from '@/lib/api/client'
import * as student from '@/lib/api/student'
import { fakeJwt, httpError, reply, type MockClient } from '@/test-utils/api'

const http = api as unknown as MockClient

const signIn = (role = 'STUDENT', sub = 7) =>
  localStorage.setItem('accessToken', fakeJwt({ sub: String(sub), role }))

/**
 * Answer GETs by URL. A route value may be data, a function of the request
 * params, or an Error/number to fail with that status.
 */
function routes(table: Record<string, unknown>) {
  http.get.mockImplementation((url: string, config?: { params?: any }) => {
    if (!(url in table)) return httpError(404)
    const value = table[url]
    if (typeof value === 'number') return httpError(value)
    return reply(typeof value === 'function' ? (value as any)(config?.params) : value)
  })
}

const rawCourse = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  title: 'Maths',
  grade: 11,
  thumbnail_url: 'https://img/c.png',
  description: 'Algebra',
  price: '1500.00',
  status: 'PUBLISHED',
  course_type: 'video',
  stream_ids: [1, 2],
  modules: [],
  ...overrides,
})

beforeEach(() => jest.resetAllMocks())

describe('catalogue', () => {
  it('maps published courses and passes the viewer grade and stream', async () => {
    routes({ '/api/courses/': { items: [rawCourse(), rawCourse({ id: 11, status: 'DRAFT', course_type: 'exam', price: null, grade: null, stream_ids: null })] } })

    const [video, exam] = await student.getAvailableCourses(12, 3)

    expect(http.get).toHaveBeenCalledWith('/api/courses/', {
      params: { grade: 12, stream_id: 3 },
    })
    expect(video).toEqual({
      id: '10',
      title: 'Maths',
      subject: '',
      grade: 11,
      image_url: 'https://img/c.png',
      description: 'Algebra',
      price: 1500,
      is_active: true,
      course_type: 'video',
      stream_ids: ['1', '2'],
      modules: [],
    })
    expect(exam).toMatchObject({
      is_active: false,
      course_type: 'exam',
      price: 0,
      grade: 0,
      stream_ids: [],
    })
  })

  it('browses without filters and copes with an empty answer', async () => {
    routes({ '/api/courses/': {} })
    expect(await student.getAvailableCourses()).toEqual([])
    expect(http.get).toHaveBeenCalledWith('/api/courses/', {
      params: { grade: undefined, stream_id: undefined },
    })
  })
})

describe('getCourseOverview — exam courses', () => {
  const examCourse = rawCourse({
    course_type: 'exam',
    price: 0,
    modules: [
      { id: 100, title: 'Paper 1', order: 1, lesson_count: 0 },
      { id: 200, title: 'Paper 2', order: 2, is_active: false },
    ],
  })
  const exams = [
    { id: 1, module_id: 100, title: 'Q1', time_limit_minutes: 30, question_count: 10 },
    { id: 2, module_id: 100, title: 'Q2' },
    { id: 3, module_id: 200, title: 'Q3' },
    { id: 4, module_id: null, title: 'Loose' },
  ]

  it('shows an outline without attempts when the student has no access', async () => {
    signIn()
    routes({
      '/api/courses/10': examCourse,
      '/api/enrollments/me/access': { course: false, lessons: [] },
      '/api/assessments/': exams,
    })

    const course = await student.getCourseOverview('10')

    expect(course.is_enrolled).toBe(false)
    expect(http.get).not.toHaveBeenCalledWith('/api/assessments/my-attempts', expect.anything())
    const [paper1, paper2] = course.sub_courses!
    expect(paper1).toMatchObject({ id: '100', is_enrolled: false, progress_percentage: 0, order_number: 1 })
    expect(paper1.exams!.map((e) => e.id)).toEqual(['1', '2'])
    expect(paper1.exams![0]).toMatchObject({
      duration_minutes: 30,
      total_questions: 10,
      is_free: true,
      enrollment_type: null,
      already_attempted: false,
    })
    expect(paper2).toMatchObject({ is_active: false, exams: [expect.objectContaining({ id: '3' })] })
    expect(course.modules).toEqual([])
  })

  it('unlocks a single granted lesson and counts passed exams', async () => {
    signIn()
    routes({
      '/api/courses/10': examCourse,
      '/api/enrollments/me/access': { course: false, lessons: [100] },
      '/api/assessments/': exams,
      '/api/assessments/my-attempts': [
        { assessment_id: 1, last_score: 90, passed: true },
        { assessment_id: 2, last_score: 20, passed: false },
      ],
    })

    const [paper1, paper2] = (await student.getCourseOverview('10')).sub_courses!

    expect(paper1.is_enrolled).toBe(true)
    expect(paper1.progress_percentage).toBe(50)
    expect(paper1.exams![0]).toMatchObject({
      is_enrolled: true,
      enrollment_type: 'course',
      already_attempted: true,
      last_score: 90,
      is_passed: true,
    })
    expect(paper2.is_enrolled).toBe(false)
  })

  it('treats staff as having full access without asking the server', async () => {
    signIn('TEACHER')
    routes({ '/api/courses/10': examCourse, '/api/assessments/': exams, '/api/assessments/my-attempts': [] })
    const course = await student.getCourseOverview('10')
    expect(course.is_enrolled).toBe(true)
    expect(http.get).not.toHaveBeenCalledWith('/api/enrollments/me/access', expect.anything())
  })

  it('treats an access-check failure as no access', async () => {
    signIn()
    routes({ '/api/courses/10': examCourse, '/api/enrollments/me/access': 500, '/api/assessments/': exams })
    expect((await student.getCourseOverview('10')).is_enrolled).toBe(false)
  })
})

describe('getCourseOverview — video courses', () => {
  const videoCourse = rawCourse({
    modules: [
      { id: 100, title: 'Lesson 1', order: 1, lesson_count: 2 },
      { id: 200, title: 'Lesson 2', order: 2, lesson_count: 5 },
    ],
  })

  it('shows anonymous visitors only the outline and video counts', async () => {
    routes({ '/api/courses/10': videoCourse })
    const course = await student.getCourseOverview('10')
    expect(course.is_enrolled).toBe(false)
    expect(course.modules!.map((m) => [m.id, m.video_count, m.videos.length])).toEqual([
      ['100', 2, 0],
      ['200', 5, 0],
    ])
    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('loads videos, materials, checkpoints and progress for enrolled students', async () => {
    signIn()
    routes({
      '/api/courses/10': videoCourse,
      '/api/enrollments/me/access': { course: true, lessons: [] },
      '/api/progress/courses/10/lessons/progress': [
        { lesson_id: 1, is_completed: true },
        { lesson_id: 2, is_completed: false },
      ],
      '/api/courses/10/modules/100/lessons': [
        {
          id: 1,
          title: 'Intro',
          youtube_video_id: 'yt1',
          duration_seconds: 300,
          order: 1,
          checkpoints: [
            { id: 9, video_id: 1, timestamp_seconds: 60, questions: [{ id: 5, checkpoint_id: 9, question_text: '?' }] },
          ],
        },
        { id: 2, title: 'Next', order: 2 },
      ],
      '/api/courses/10/modules/100/materials': [
        { id: 7, module_id: 100, lesson_id: 1, title: 'Slides', file_url: 'u', file_type: 'pdf', order: 1 },
        { id: 8, module_id: 100, lesson_id: null, title: 'Notes', file_url: 'u2', file_type: 'pdf' },
      ],
      // Lesson 2 fails to load: shown as empty rather than breaking the page.
      '/api/courses/10/modules/200/lessons': 500,
      '/api/courses/10/modules/200/materials': 500,
    })

    const [lesson1, lesson2] = (await student.getCourseOverview('10')).modules!

    expect(lesson1).toMatchObject({ is_enrolled: true, video_count: 2, progress_percentage: 50 })
    const [intro, next] = lesson1.videos
    expect(intro).toMatchObject({
      id: '1',
      yt_video_id: 'yt1',
      is_completed: true,
      watched_percentage: 100,
      materials: [expect.objectContaining({ id: '7', video_id: '1' })],
    })
    expect(intro.checkpoints).toEqual([
      {
        id: '9',
        video_id: '1',
        timestamp_seconds: 60,
        questions: [{ id: '5', checkpoint_id: '9', question_text: '?' }],
      },
    ])
    expect(next).toMatchObject({ yt_video_id: '', duration_seconds: 0, is_completed: false, materials: [], checkpoints: [] })
    expect(lesson1.materials.map((m) => [m.id, m.video_id, m.order_number])).toEqual([
      ['7', '1', 1],
      ['8', null, 0],
    ])
    expect(lesson2).toMatchObject({ videos: [], materials: [], video_count: 0, progress_percentage: 0 })
  })

  it('still lists videos when no progress was recorded', async () => {
    signIn()
    routes({
      '/api/courses/10': rawCourse({ modules: [{ id: 100, title: 'L' }] }),
      '/api/enrollments/me/access': { course: true, lessons: [] },
      '/api/progress/courses/10/lessons/progress': 404,
      '/api/courses/10/modules/100/lessons': [{ id: 1, title: 'Intro' }],
      '/api/courses/10/modules/100/materials': [],
    })
    const [lesson] = (await student.getCourseOverview('10')).modules!
    expect(lesson.videos[0].is_completed).toBe(false)
  })

  it('getVideoClassDetails is the overview', async () => {
    routes({ '/api/courses/10': videoCourse })
    expect((await student.getVideoClassDetails('10')).id).toBe('10')
  })
})

describe('exam lists', () => {
  it('lists a course\'s exams with lesson-level access', async () => {
    signIn()
    routes({
      '/api/assessments/': [{ id: 1, module_id: 5 }, { id: 2, module_id: 6 }],
      '/api/enrollments/me/access': { course: false, lessons: [5] },
      '/api/assessments/my-attempts': [],
    })
    const exams = await student.getCourseExams('10')
    expect(exams.map((e) => [e.id, e.is_enrolled])).toEqual([
      ['1', true],
      ['2', false],
    ])
  })

  it('lists a lesson\'s exams, looking up access for their course', async () => {
    signIn()
    routes({
      '/api/assessments/': [{ id: 1, course_id: 10, module_id: 5 }],
      '/api/enrollments/me/access': (p: any) => (p.course_id === '10' ? { course: true, lessons: [] } : {}),
      '/api/assessments/my-attempts': 500,
    })
    const [exam] = await student.getSubCourseExams('5')
    expect(http.get).toHaveBeenCalledWith('/api/assessments/', { params: { module_id: '5' } })
    expect(exam.is_enrolled).toBe(true)
  })

  it('returns nothing for an empty lesson', async () => {
    routes({ '/api/assessments/': [] })
    expect(await student.getSubCourseExams('5')).toEqual([])
    expect(http.get).toHaveBeenCalledTimes(1)
  })
})

describe('enrollment', () => {
  it.each([
    ['enrollFreeSubCourse', () => student.enrollFreeSubCourse('1')],
    ['enrollFreeVideoModule', () => student.enrollFreeVideoModule('1')],
  ])('%s is not supported', async (_n, call) => {
    await expect(call()).rejects.toThrow('Free enrollment is not supported')
  })

  it('enrolls in a free course through payment_service', async () => {
    http.post.mockReturnValue(reply({ message: 'Enrolled successfully' }))
    expect(await student.enrollFreeVideoCourse('10')).toEqual({
      message: 'Enrolled successfully',
      enrollment_id: undefined,
      enrollment_type: 'course',
    })
    expect(http.post).toHaveBeenCalledWith('/api/payments/free-enroll', { course_id: 10 })
  })

  it('lists active whole-course enrollments whose course still exists', async () => {
    signIn()
    routes({
      '/api/enrollments/me': [
        { enrollment_id: 1, course_id: 10, status: 'ACTIVE', enrolled_at: '2026-01-01' },
        { enrollment_id: 2, course_id: 11, status: 'active', enrolled_at: '2026-01-02' },
        { enrollment_id: 3, course_id: 12, status: 'SUSPENDED' },
        { enrollment_id: 4, course_id: 13, status: 'ACTIVE', module_id: 9 },
      ],
      '/api/courses/10': rawCourse(),
      // course 11 was unpublished since
    })
    const res = await student.getMyEnrollments()
    expect(res.courses).toEqual([
      {
        enrollment_id: '1',
        course: {
          id: '10',
          title: 'Maths',
          subject: '',
          grade: 11,
          image_url: 'https://img/c.png',
          price: 1500,
          course_type: 'video',
        },
        enrolled_at: '2026-01-01',
        exams: [],
      },
    ])
    expect(res).toMatchObject({ sub_courses: [], modules: [], exams: [] })
  })

  it('returns no enrollments when signed out', async () => {
    expect(await student.getMyEnrollments()).toEqual({
      courses: [],
      sub_courses: [],
      modules: [],
      exams: [],
    })
    expect(http.get).not.toHaveBeenCalled()
  })
})

describe('checkExamAccess', () => {
  const exam = (overrides = {}) => ({
    id: 1,
    course_id: 10,
    module_id: 5,
    title: 'Q1',
    time_limit_minutes: 30,
    question_count: 10,
    scheduled_start: null,
    ...overrides,
  })

  it('is open for an enrolled student', async () => {
    signIn()
    routes({ '/api/assessments/1': exam(), '/api/enrollments/me/access': { course: true, lessons: [] } })
    expect(await student.checkExamAccess('1')).toEqual({
      has_access: true,
      is_locked: false,
      lock_message: null,
      lock_reason: null,
      exam: { title: 'Q1', duration_minutes: 30, total_questions: 10 },
    })
  })

  it('locks it for students who are not enrolled', async () => {
    signIn()
    routes({ '/api/assessments/1': exam(), '/api/enrollments/me/access': { course: false, lessons: [] } })
    expect(await student.checkExamAccess('1')).toMatchObject({
      has_access: false,
      is_locked: true,
      lock_reason: 'not_enrolled',
      lock_message: 'Enroll in this course to take this exam.',
    })
  })

  it('locks it until the scheduled start', async () => {
    signIn('ADMIN')
    const later = new Date(Date.now() + 3_600_000).toISOString()
    routes({ '/api/assessments/1': exam({ scheduled_start: later }) })
    const res = await student.checkExamAccess('1')
    expect(res).toMatchObject({ has_access: false, lock_reason: 'not_started_yet' })
    expect(res.lock_message).toMatch(/^This exam opens on /)
  })
})

describe('taking an exam', () => {
  it('starts an attempt, packing the session into the attempt id', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-25T10:00:00Z').getTime())
    http.post.mockReturnValue(
      reply({
        session_id: 'sess_abc',
        assessment_id: 1,
        title: 'Q1',
        time_remaining_seconds: 1800,
        questions: [
          { id: 3, question_text: '2+2?', position: 2, options_json: '["3","4"]', option_image_urls: [null, 'https://img/4.png'] },
          { id: 4, question_text: 'Broken', position: 1, options_json: '{bad' },
          { id: 5, question_text: 'None', position: 3, options_json: null },
        ],
      })
    )

    const res = await student.startExam('1')

    expect(http.post).toHaveBeenCalledWith('/api/assessments/1/start')
    expect(res.attempt_id).toBe('1:sess_abc')
    expect(res.duration_minutes).toBe(30)
    expect(new Date(res.ends_at).getTime() - new Date(res.started_at).getTime()).toBe(1_800_000)
    expect(res.questions[0]).toEqual({
      id: '3',
      question_text: '2+2?',
      question_image_url: null,
      explanation: null,
      order_number: 2,
      options: [
        { id: '3', option_text: '3', option_image_url: null, order_number: 0 },
        { id: '4', option_text: '4', option_image_url: 'https://img/4.png', order_number: 1 },
      ],
    })
    expect(res.questions[1].options).toEqual([])
    expect(res.questions[2].options).toEqual([])
    jest.restoreAllMocks()
  })

  it('submits answers by option text and maps the result', async () => {
    http.post.mockReturnValue(
      reply({
        correct_count: 1,
        total_questions: 2,
        time_taken_seconds: 95,
        new_badges: [{ id: 3, name: 'First Step' }],
        review: [
          {
            question_id: 3,
            question_text: '2+2?',
            selected_option_id: '4',
            correct_option_id: '4',
            is_correct: true,
            options: [{ id: '4', option_text: '4', order_number: 0 }],
          },
        ],
        ranking: { course_id: 10, exam_title: 'Q1', overall_rank: 2, district_rank: 1 },
      })
    )

    const res = await student.submitExamAttempt('1:sess_abc', {
      answers: [
        { question_id: '3', selected_option_id: '4' },
        { question_id: '4', selected_option_id: null },
      ],
    })

    expect(http.post).toHaveBeenCalledWith('/api/assessments/1/submit', {
      session_id: 'sess_abc',
      answers: [
        { question_id: 3, selected_option: '4' },
        { question_id: 4, selected_option: '' },
      ],
    })
    expect(res).toMatchObject({
      attempt_id: '1:sess_abc',
      marks_obtained: 1,
      total_questions: 2,
      time_taken_seconds: 95,
      new_badges: [{ id: '3', name: 'First Step' }],
      ranking: { exam_id: '1', course_id: '10', overall_rank: 2, district_rank: 1 },
    })
    expect(res.review[0]).toMatchObject({
      question_id: '3',
      explanation: null,
      question_image_url: null,
      video_url: null,
      options: [{ id: '4', option_text: '4', option_image_url: null, order_number: 0 }],
    })
  })

  it('reports violations without ever failing the exam', async () => {
    http.post.mockReturnValue(reply(null))
    await student.reportViolation('1:sess_abc', 'tab_switch', 'Alt+Tab')
    expect(http.post).toHaveBeenCalledWith('/api/assessments/1/violations', {
      session_id: 'sess_abc',
      violation_type: 'tab_switch',
      detail: 'Alt+Tab',
    })
    http.post.mockReturnValue(httpError(500))
    await expect(student.reportViolation('1:x', 'other')).resolves.toBeUndefined()
  })

  it('loads the last attempt, or null when there is none', async () => {
    routes({ '/api/assessments/1/my-last-attempt': { correct_count: 3, total_questions: 5 } })
    const last = await student.getLastAttempt('1')
    expect(last).toMatchObject({
      attempt_id: '1:',
      marks_obtained: 3,
      new_badges: [],
      review: [],
      time_taken_seconds: 0,
      ranking: { course_id: '', overall_rank: null },
    })
    routes({})
    expect(await student.getLastAttempt('1')).toBeNull()
  })

  it('maps an attempt review with defaults', async () => {
    routes({
      '/api/assessments/submissions/9/review': {
        attempt_id: 9,
        marks_obtained: 4,
        total_questions: 5,
        submitted_at: 'x',
        score: 80,
        passed: true,
        ranking: { exam_id: 1, course_id: 10 },
      },
    })
    expect(await student.fetchAttemptReview('9')).toEqual({
      attempt_id: '9',
      marks_obtained: 4,
      total_questions: 5,
      time_taken_seconds: 0,
      submitted_at: 'x',
      score: 80,
      passed: true,
      review: [],
      ranking: {
        exam_id: '1',
        course_id: '10',
        exam_title: '',
        course_title: '',
        subject: '',
        overall_rank: null,
        district_rank: null,
      },
    })
  })
})

describe('results and rankings', () => {
  it('lists my attempts with string ids', async () => {
    routes({
      '/api/assessments/my-submissions': [
        { attempt_id: 1, exam_id: 2, course_id: 3, sub_course_id: null, exam_title: 'Q' },
      ],
    })
    const [item] = await student.getMyAttempts(5)
    expect(http.get).toHaveBeenCalledWith('/api/assessments/my-submissions', { params: { limit: 5 } })
    expect(item).toMatchObject({ attempt_id: '1', exam_id: '2', course_id: '3', sub_course_id: null })
  })

  it('passes leaderboard filters only when set', async () => {
    routes({ '/api/assessments/rankings/leaderboard': [] })
    await student.getRankingsLeaderboard('1', '', 10, 20)
    expect(http.get).toHaveBeenCalledWith('/api/assessments/rankings/leaderboard', {
      params: { exam_id: '1', district: undefined, limit: 10, offset: 20 },
    })
    await student.getRankingsLeaderboard('1', 'Colombo')
    expect(http.get).toHaveBeenLastCalledWith('/api/assessments/rankings/leaderboard', {
      params: { exam_id: '1', district: 'Colombo', limit: 50, offset: 0 },
    })
  })

  it.each([
    ['getExamRanking', () => student.getExamRanking('1'), '/api/assessments/rankings/exam/1'],
    ['getRankingExams', () => student.getRankingExams(), '/api/assessments/rankings/exams'],
    ['getPlatformStats', () => student.getPlatformStats(), '/api/analytics/platform-stats'],
    ['getMyProgress', () => student.getMyProgress(), '/api/analytics/me/progress'],
    ['getReferralSummary', () => student.getReferralSummary(), '/api/users/referral/summary'],
    ['getMyClassEnrollments', () => student.getMyClassEnrollments(), '/api/enrollments/my-class-enrollments'],
  ])('%s passes the response through', async (_n, call, url) => {
    routes({ [url]: { ok: true } })
    expect(await call()).toEqual({ ok: true })
  })
})

describe('profile reference data and referrals', () => {
  it('needs a grade to list subjects', async () => {
    expect(await student.getSubjects()).toEqual([])
    routes({ '/api/users/subjects': ['Maths'] })
    expect(await student.getSubjects(12, '')).toEqual(['Maths'])
    expect(http.get).toHaveBeenCalledWith('/api/users/subjects', {
      params: { grade: 12, stream_id: undefined },
    })
  })

  it('maps streams', async () => {
    routes({ '/api/users/streams': [{ id: 1, name: 'Bio', subjects: ['B'], is_active: true }] })
    expect(await student.getStreams()).toEqual([
      { id: '1', name: 'Bio', subjects: ['B'], description: null, is_active: true },
    ])
  })

  it('lists referral events and applies a trimmed code', async () => {
    routes({ '/api/users/referral/events': { events: [] } })
    await student.getReferralEvents(5)
    expect(http.get).toHaveBeenCalledWith('/api/users/referral/events', { params: { limit: 5 } })

    http.post.mockReturnValue(reply({ message: 'Applied' }))
    expect(await student.applyReferralCode('  ama1  ')).toEqual({ message: 'Applied', credit_amount: 0 })
    expect(http.post).toHaveBeenCalledWith('/api/users/referral/apply', { referral_code: 'ama1' })
  })

  it('records video progress with defaults', async () => {
    http.post.mockReturnValue(reply({ lesson_id: 3 }))
    await student.updateVideoProgress({ course_id: '10', video_id: '3' })
    expect(http.post).toHaveBeenCalledWith('/api/progress/courses/10/lessons/progress', {
      lesson_id: 3,
      total_lessons: undefined,
      watch_duration_seconds: 0,
      last_position_seconds: 0,
    })
  })
})

describe('class packages', () => {
  it('filters packages by the student\'s grade, and stream from grade 12', async () => {
    signIn()
    routes({
      '/api/users/7': { grade: 12, stream_id: 3 },
      '/api/enrollments/class-packages': [],
    })
    await student.getStudentClassPackages()
    expect(http.get).toHaveBeenLastCalledWith('/api/enrollments/class-packages', {
      params: { grade: 12, stream_id: '3' },
    })
  })

  it('ignores the stream below grade 12', async () => {
    signIn()
    routes({ '/api/users/7': { grade: 10, stream_id: 3 }, '/api/enrollments/class-packages': [] })
    await student.getStudentClassPackages()
    expect(http.get).toHaveBeenLastCalledWith('/api/enrollments/class-packages', {
      params: { grade: 10, stream_id: undefined },
    })
  })

  it('shows every package to visitors and to students without a profile', async () => {
    routes({ '/api/enrollments/class-packages': [{ id: '1' }] })
    expect(await student.getStudentClassPackages()).toEqual([{ id: '1' }])
    signIn()
    await student.getStudentClassPackages() // profile lookup 404s
    expect(http.get).toHaveBeenLastCalledWith('/api/enrollments/class-packages', {
      params: { grade: undefined, stream_id: undefined },
    })
  })

  it('enrolls in a free package', async () => {
    http.post.mockReturnValue(reply({ id: '5' }))
    expect(await student.enrollFreeClassPackage('2')).toEqual({ id: '5' })
    expect(http.post).toHaveBeenCalledWith('/api/enrollments/class-packages/2/enroll-free')
  })
})
