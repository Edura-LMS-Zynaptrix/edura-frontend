/**
 * Student API - Course enrollment and exam access
 *
 * A course holds lessons (course_service modules): video courses keep videos
 * and materials inside each lesson, exam courses keep exams. Edura has no
 * class-packages or per-lesson enrollment — enrollment is per course. Every
 * export below keeps its original name/signature so pages compile unchanged;
 * functions that map to a real Edura endpoint call it (with best-effort
 * field translation), and functions with no backing service return an empty
 * default or reject clearly — never a fabricated network call.
 */

import apiClient from './client'
import type { Badge } from '@/lib/redux/slices/badgesSlice'
import type { StudentProgressData } from './admin'

function getDecodedToken(): { sub: string; role: string } | null {
  if (typeof window === 'undefined') return null
  const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken')
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return { sub: String(json.sub), role: String(json.role || '').toLowerCase() }
  } catch {
    return null
  }
}

export interface Course {
  id: string
  title: string
  subject: string
  grade: number
  image_url: string | null
  description: string | null
  price: number
  is_active: boolean
  stream_ids?: string[]
  is_enrolled?: boolean
  enrollment_expires_at?: string | null
  course_type: 'exam' | 'video'
  progress_percentage?: number
  sub_courses?: {
    id: string
    title: string
    description: string | null
    image_url: string | null
    order_number: number
    is_active: boolean
    is_enrolled?: boolean
    progress_percentage?: number
    exams?: ExamWithAccess[]
  }[]
  modules?: VideoModule[]
}

export interface VideoModule {
  id: string
  title: string
  description: string | null
  image_url: string | null
  order_number: number
  is_active: boolean
  is_enrolled?: boolean
  videos: VideoLesson[]
  materials: VideoMaterial[]
  video_count: number
  progress_percentage?: number
}

export interface VideoLesson {
  id: string
  module_id: string
  title: string
  description: string | null
  yt_video_id: string
  duration_seconds: number
  order_number: number
  is_published: boolean
  is_completed: boolean
  watched_percentage: number
  materials?: VideoMaterial[]
  checkpoints?: VideoCheckpoint[]
}

export interface VideoCheckpoint {
  id: string
  video_id: string
  timestamp_seconds: number
  questions: CheckpointQuestion[]
}

export interface CheckpointQuestion {
  id: string
  checkpoint_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string | null
  option_d: string | null
  option_e: string | null
  correct_option: string
  explanation: string | null
  order_number: number
}

export interface VideoMaterial {
  id: string
  module_id: string
  video_id?: string | null
  title: string
  file_url: string
  file_type: string
  file_public_id: string | null
  order_number: number
}

export interface ExamWithAccess {
  id: string
  title: string
  description: string | null
  image_url: string | null
  duration_minutes: number
  total_questions: number
  is_free: boolean
  is_enrolled: boolean
  enrollment_type: 'course' | 'exam' | null
  already_attempted: boolean
  last_score: number | null
  last_total: number | null
  scheduled_start: string | null
  is_locked?: boolean
  lock_reason?: string | null
  lock_message?: string | null
  is_passed?: boolean
}

export interface EnrollmentResponse {
  message: string
  enrollment_id?: string
  enrollment_type?: string
}

export interface CourseExamItem {
  id: string
  title: string
  duration_minutes: number
  total_questions: number
  image_url: string | null
  scheduled_start: string | null
  stream_ids?: string[]
  sub_course_id: string | null
  sub_course_title: string | null
  already_attempted: boolean
  last_score: number | null
  last_total: number | null
  is_locked?: boolean
  lock_reason?: string | null
  lock_message?: string | null
}

export interface EnrolledCourseItem {
  enrollment_id: string
  course: {
    id: string
    title: string
    subject: string
    grade: number
    image_url: string | null
    price: number
    course_type?: 'exam' | 'video'
    progress_percentage?: number
  }
  enrolled_at: string
  exams: CourseExamItem[]
}

export interface EnrolledExamItem {
  enrollment_id: string
  exam: {
    id: string
    title: string
    duration_minutes: number
    total_questions: number
    image_url: string | null
    sub_course_id: string | null
    sub_course_title: string | null
  }
  enrolled_at: string
  already_attempted: boolean
  last_score: number | null
  last_total: number | null
}

export interface EnrolledSubCourseItem {
  enrollment_id: string
  sub_course: {
    id: string
    title: string
    course_id?: string | null
    course_title: string
    subject: string
    image_url: string | null
    course?: { id: string; title: string }
  }
  progress_percentage?: number
  enrolled_at: string
  exams: CourseExamItem[]
}

export interface EnrolledModuleItem {
  enrollment_id: string
  module: {
    id: string
    title: string
    course_id?: string | null
    course_title: string
    subject: string
    image_url: string | null
  }
  progress_percentage?: number
  enrolled_at: string
}

export interface MyEnrollmentsResponse {
  meta?: {
    offset: number
    limit: number
    total_courses: number
    total_sub_courses: number
    total_exams: number
  }
  courses: EnrolledCourseItem[]
  sub_courses: EnrolledSubCourseItem[]
  modules: EnrolledModuleItem[]
  exams: EnrolledExamItem[]
}

export interface ExamQuestionOptionView {
  id: string
  option_text: string | null
  option_image_url: string | null
  order_number: number
}

export interface ExamQuestionView {
  id: string
  question_text: string
  question_image_url: string | null
  explanation: string | null
  order_number: number
  options: ExamQuestionOptionView[]
}

export interface StartExamResponse {
  attempt_id: string
  exam_id: string
  exam_title: string
  subject: string
  duration_minutes: number
  started_at: string
  ends_at: string
  questions: ExamQuestionView[]
}

export interface SubmitExamRequest {
  answers: Array<{
    question_id: string
    selected_option_id: string | null
  }>
}

export interface SubmitExamResponse {
  attempt_id: string
  marks_obtained: number
  total_questions: number
  time_taken_seconds: number
  review: Array<{
    question_id: string
    question_text: string
    explanation: string | null
    selected_option_id: string | null
    correct_option_id: string
    is_correct: boolean
  }>
  ranking: {
    exam_id: string
    course_id: string
    exam_title: string
    course_title: string
    subject: string
    overall_rank: number | null
    district_rank: number | null
  }
  new_badges?: Badge[]
}

export interface ExamRankResponse {
  exam_id: string
  course_id: string
  exam_title: string
  course_title: string
  subject: string
  overall_rank: number | null
  district_rank: number | null
}

export interface MyAttemptItem {
  attempt_id: string
  exam_id: string
  attempt_number: number
  course_id?: string | null
  sub_course_id?: string | null
  exam_title: string
  course_title: string
  subject: string
  marks_obtained: number | null
  total_questions: number | null
  time_taken_seconds: number | null
  status: string
  started_at: string | null
  submitted_at: string | null
  overall_rank: number | null
  district_rank: number | null
}

// ── Courses (real: course_service) ──────────────────────────────────────────

function mapCourse(c: any): Course {
  return {
    id: String(c.id),
    title: c.title,
    subject: '',
    grade: c.grade ?? 0,
    image_url: c.thumbnail_url ?? null,
    description: c.description ?? null,
    price: Number(c.price ?? 0),
    is_active: c.status === 'PUBLISHED',
    course_type: c.course_type === 'exam' ? 'exam' : 'video',
    stream_ids: (c.stream_ids ?? []).map(String),
    modules: [],
  }
}

function mapMaterial(m: any): VideoMaterial {
  return {
    id: String(m.id),
    module_id: String(m.module_id),
    video_id: m.lesson_id != null ? String(m.lesson_id) : null,
    title: m.title,
    file_url: m.file_url,
    file_type: m.file_type,
    file_public_id: m.file_public_id ?? null,
    order_number: m.order ?? 0,
  }
}

// Students need an ACTIVE enrollment; teachers/admins preview everything.
interface CourseAccess {
  course: boolean // the whole course (enrolled, or an admin grant)
  lessons: Set<string> // single lessons an admin granted on their own
}

const unlocks = (access: CourseAccess, lessonId: string | number | null | undefined) =>
  access.course || (lessonId != null && access.lessons.has(String(lessonId)))

// Students need an ACTIVE enrollment (or a lesson grant); teachers/admins preview everything.
async function getCourseAccess(courseId: string): Promise<CourseAccess> {
  const decoded = getDecodedToken()
  if (!decoded) return { course: false, lessons: new Set() }
  if (decoded.role !== 'student') return { course: true, lessons: new Set() }
  try {
    // Server-side answer: course enrollment, a covering class package, or single-lesson grants.
    const res = await apiClient.get('/api/enrollments/me/access', { params: { course_id: courseId } })
    return { course: !!res.data.course, lessons: new Set((res.data.lessons as number[]).map(String)) }
  } catch {
    return { course: false, lessons: new Set() }
  }
}

async function getMyAttemptSummaries(courseId: string): Promise<Map<string, any>> {
  const decoded = getDecodedToken()
  if (!decoded) return new Map()
  try {
    const res = await apiClient.get('/api/assessments/my-attempts', { params: { course_id: courseId } })
    return new Map((res.data as any[]).map((a) => [String(a.assessment_id), a]))
  } catch {
    return new Map()
  }
}

// `grade` is the viewer's own grade — course_service applies the same O/L
// (10<->11) and A/L (12<->13) unlock bands the reference platform uses.
// `stream_id` additionally scopes grade 12/13 courses to the viewer's own
// A/L stream (a course can belong to more than one stream). Both omitted
// for anonymous/ungraded browsing, which shows every published course.
export const getAvailableCourses = async (grade?: number | null, streamId?: number | string | null): Promise<Course[]> => {
  const response = await apiClient.get('/api/courses/', {
    params: { grade: grade ?? undefined, stream_id: streamId ?? undefined },
  })
  const items = response.data?.items ?? []
  return items.map(mapCourse)
}

function mapExam(a: any, isEnrolled: boolean, isFree: boolean, attempt?: any): ExamWithAccess {
  return {
    id: String(a.id),
    title: a.title,
    description: a.description ?? null,
    image_url: a.image_url ?? null,
    duration_minutes: a.time_limit_minutes ?? 0,
    total_questions: a.question_count ?? 0,
    is_free: isFree,
    is_enrolled: isEnrolled,
    enrollment_type: isEnrolled ? 'course' : null,
    already_attempted: !!attempt,
    last_score: attempt ? attempt.last_score : null,
    last_total: null,
    is_passed: attempt ? !!attempt.passed : false,
    scheduled_start: a.scheduled_start ?? null,
  }
}

// Course → lessons (course_service modules). Video courses: lessons hold
// videos + materials. Exam courses: lessons hold exams (assessment_service).
export const getCourseOverview = async (courseId: string): Promise<Course> => {
  const [courseRes, access] = await Promise.all([
    apiClient.get(`/api/courses/${courseId}`, { params: { include_modules: true } }),
    getCourseAccess(courseId),
  ])
  const course = mapCourse(courseRes.data)
  course.is_enrolled = access.course
  const hasAnyAccess = access.course || access.lessons.size > 0
  const lessons: any[] = courseRes.data.modules ?? []

  if (course.course_type === 'exam') {
    const [examsRes, attempts] = await Promise.all([
      apiClient.get('/api/assessments/', { params: { course_id: courseId } }),
      hasAnyAccess ? getMyAttemptSummaries(courseId) : Promise.resolve(new Map<string, any>()),
    ])
    const exams: any[] = examsRes.data
    course.sub_courses = lessons.map((m) => {
      const lessonUnlocked = unlocks(access, m.id)
      const lessonExams = exams
        .filter((a) => a.module_id != null && String(a.module_id) === String(m.id))
        .map((a) => mapExam(a, lessonUnlocked, course.price === 0, attempts.get(String(a.id))))
      const passed = lessonExams.filter((e) => e.is_passed).length
      return {
        id: String(m.id),
        title: m.title,
        description: m.description ?? null,
        image_url: m.image_url ?? null,
        order_number: m.order ?? 0,
        is_active: m.is_active ?? true,
        is_enrolled: lessonUnlocked,
        progress_percentage: lessonExams.length ? Math.round((passed / lessonExams.length) * 100) : 0,
        exams: lessonExams,
      }
    })
    course.modules = []
    return course
  }

  // Video ids and material files are enrollment-gated by course_service, so
  // only fetch them for enrolled viewers; everyone else sees the outline.
  let completedIds = new Set<string>()
  if (hasAnyAccess) {
    try {
      const progressRes = await apiClient.get(`/api/progress/courses/${courseId}/lessons/progress`)
      completedIds = new Set(
        progressRes.data.filter((p: any) => p.is_completed).map((p: any) => String(p.lesson_id))
      )
    } catch {
      // no progress recorded yet
    }
  }

  course.modules = await Promise.all(
    lessons.map(async (m: any): Promise<VideoModule> => {
      const lessonUnlocked = unlocks(access, m.id)
      let videos: VideoLesson[] = []
      let materials: VideoMaterial[] = []
      let rawMaterials: any[] = []
      if (lessonUnlocked) {
        const [videosRes, materialsRes] = await Promise.all([
          apiClient.get(`/api/courses/${courseId}/modules/${m.id}/lessons`).catch(() => ({ data: [] })),
          apiClient.get(`/api/courses/${courseId}/modules/${m.id}/materials`).catch(() => ({ data: [] })),
        ])
        rawMaterials = materialsRes.data
        materials = rawMaterials.map(mapMaterial)
        videos = videosRes.data.map((l: any) => ({
          id: String(l.id),
          module_id: String(m.id),
          title: l.title,
          description: l.description ?? null,
          yt_video_id: l.youtube_video_id ?? '',
          duration_seconds: l.duration_seconds ?? 0,
          order_number: l.order ?? 0,
          is_published: true,
          is_completed: completedIds.has(String(l.id)),
          watched_percentage: completedIds.has(String(l.id)) ? 100 : 0,
          materials: rawMaterials
            .filter((mat) => mat.lesson_id != null && String(mat.lesson_id) === String(l.id))
            .map(mapMaterial),
          checkpoints: (l.checkpoints ?? []).map((cp: any) => ({
            id: String(cp.id),
            video_id: String(cp.video_id),
            timestamp_seconds: cp.timestamp_seconds,
            questions: (cp.questions ?? []).map((q: any) => ({
              ...q,
              id: String(q.id),
              checkpoint_id: String(q.checkpoint_id),
            })),
          })),
        }))
      }
      const videoCount = lessonUnlocked ? videos.length : m.lesson_count ?? 0
      const done = videos.filter((v) => v.is_completed).length
      return {
        id: String(m.id),
        title: m.title,
        description: m.description ?? null,
        image_url: m.image_url ?? null,
        order_number: m.order ?? 0,
        is_active: m.is_active ?? true,
        is_enrolled: lessonUnlocked,
        videos,
        materials,
        video_count: videoCount,
        progress_percentage: videos.length ? Math.round((done / videos.length) * 100) : 0,
      }
    })
  )
  return course
}

export const getCourseExams = async (courseId: string): Promise<ExamWithAccess[]> => {
  const [examsRes, access, attempts] = await Promise.all([
    apiClient.get('/api/assessments/', { params: { course_id: courseId } }),
    getCourseAccess(courseId),
    getMyAttemptSummaries(courseId),
  ])
  return examsRes.data.map((a: any) => mapExam(a, unlocks(access, a.module_id), false, attempts.get(String(a.id))))
}

export const getSubCourseExams = async (subCourseId: string): Promise<ExamWithAccess[]> => {
  const response = await apiClient.get('/api/assessments/', { params: { module_id: subCourseId } })
  const exams: any[] = response.data
  if (exams.length === 0) return []
  const courseId = String(exams[0].course_id)
  const [access, attempts] = await Promise.all([
    getCourseAccess(courseId),
    getMyAttemptSummaries(courseId),
  ])
  return exams.map((a) => mapExam(a, unlocks(access, a.module_id), false, attempts.get(String(a.id))))
}

// ── Enrollment ───────────────────────────────────────────────────────────
// enrollment_service only creates enrollments asynchronously in reaction to a
// successful payment (via RabbitMQ) — there is no direct "enroll for free"
// endpoint to call.

export const enrollFreeSubCourse = async (_subCourseId: string): Promise<EnrollmentResponse> => {
  throw new Error('Free enrollment is not supported — enrollment is created automatically after a successful payment.')
}

// payment_service has no direct "create an enrollment" endpoint — every
// enrollment (paid or free) is created by enrollment_service reacting to a
// payment.success event. For a free course this hits a dedicated endpoint
// that records a $0 payment and publishes that same event server-side,
// after re-checking the price itself (never trusts a client-supplied price).
export const enrollFreeCourse = async (courseId: string): Promise<EnrollmentResponse> => {
  const response = await apiClient.post('/api/payments/free-enroll', { course_id: Number(courseId) })
  return { message: response.data.message, enrollment_id: undefined, enrollment_type: 'course' }
}

export const enrollFreeVideoCourse = async (courseId: string): Promise<EnrollmentResponse> => {
  return enrollFreeCourse(courseId)
}

export const enrollFreeVideoModule = async (_moduleId: string): Promise<EnrollmentResponse> => {
  throw new Error('Free enrollment is not supported — enrollment is created automatically after a successful payment.')
}

export const getMyEnrollments = async (_offset = 0, _limit = 50): Promise<MyEnrollmentsResponse> => {
  const decoded = getDecodedToken()
  const empty: MyEnrollmentsResponse = { courses: [], sub_courses: [], modules: [], exams: [] }
  if (!decoded) return empty

  const enrollmentsRes = await apiClient.get('/api/enrollments/me')
  // Whole-course enrollments only; single-lesson grants show inside the course page.
  const active = (enrollmentsRes.data as any[]).filter(
    (e) => String(e.status).toUpperCase() === 'ACTIVE' && e.module_id == null
  )
  const checks = await Promise.all(
    active.map(async (enrollment) => {
      try {
        const res = await apiClient.get(`/api/courses/${enrollment.course_id}`)
        return { course: mapCourse(res.data), enrollment }
      } catch {
        return null // course unpublished or removed since enrolling
      }
    })
  )

  const courseItems: EnrolledCourseItem[] = checks
    .filter((c): c is { course: Course; enrollment: any } => !!c)
    .map(({ course, enrollment }) => ({
      enrollment_id: String(enrollment.enrollment_id),
      course: {
        id: course.id,
        title: course.title,
        subject: course.subject,
        grade: course.grade,
        image_url: course.image_url,
        price: course.price,
        course_type: course.course_type,
      },
      enrolled_at: enrollment.enrolled_at,
      exams: [],
    }))

  return { courses: courseItems, sub_courses: [], modules: [], exams: [] }
}

// Edura has no dedicated access-check endpoint; fetching the assessment plus
// the caller's enrollment covers the pre-exam preview and its two gates:
// not enrolled, and not yet open (scheduled_start in the future).
export const checkExamAccess = async (examId: string) => {
  const res = await apiClient.get(`/api/assessments/${examId}`)
  const exam = res.data
  const isEnrolled = unlocks(await getCourseAccess(String(exam.course_id)), exam.module_id)
  const startsAt = exam.scheduled_start ? new Date(exam.scheduled_start) : null
  const notStartedYet = !!startsAt && startsAt > new Date()

  let lockReason: string | null = null
  let lockMessage: string | null = null
  if (!isEnrolled) {
    lockReason = 'not_enrolled'
    lockMessage = 'Enroll in this course to take this exam.'
  } else if (notStartedYet) {
    lockReason = 'not_started_yet'
    lockMessage = `This exam opens on ${startsAt!.toLocaleString()}.`
  }

  return {
    has_access: isEnrolled && !notStartedYet,
    is_locked: lockReason !== null,
    lock_message: lockMessage,
    lock_reason: lockReason,
    exam: {
      title: exam.title as string,
      duration_minutes: (exam.time_limit_minutes as number) ?? 0,
      total_questions: (exam.question_count as number) ?? 0,
    },
  }
}

// ── Assessments (real: assessment_service) ──────────────────────────────
// Edura identifies an in-progress attempt by a Redis session_id scoped to one
// assessment; ExamBuddy's UI carries a single opaque attempt_id string, so we
// pack "assessmentId:sessionId" into attempt_id and unpack it on submit.

export const startExam = async (examId: string): Promise<StartExamResponse> => {
  const response = await apiClient.post(`/api/assessments/${examId}/start`)
  const data = response.data
  const startedAt = new Date()
  const endsAt = new Date(startedAt.getTime() + data.time_remaining_seconds * 1000)

  const questions: ExamQuestionView[] = data.questions.map((q: any) => {
    let optionTexts: string[] = []
    try {
      optionTexts = q.options_json ? JSON.parse(q.options_json) : []
    } catch {
      optionTexts = []
    }
    return {
      id: String(q.id),
      question_text: q.question_text,
      question_image_url: q.question_image_url ?? null,
      explanation: null,
      order_number: q.position,
      // Edura submits answers by option text, not a stable option id — use
      // the text itself as the id so the exam UI's selection model still works.
      options: optionTexts.map((text, idx) => ({
        id: text,
        option_text: text,
        option_image_url: q.option_image_urls?.[idx] ?? null,
        order_number: idx,
      })),
    }
  })

  return {
    attempt_id: `${examId}:${data.session_id}`,
    exam_id: String(data.assessment_id),
    exam_title: data.title,
    subject: '',
    duration_minutes: Math.round(data.time_remaining_seconds / 60),
    started_at: startedAt.toISOString(),
    ends_at: endsAt.toISOString(),
    questions,
  }
}

// Best-effort, fire-and-forget — a failed violation report shouldn't block
// or disrupt the student's exam. The backend already has a real ViolationLog
// table and endpoint; this was the missing piece that never called it, so
// every tab-switch/screenshot "violation" was previously only ever visible
// in the student's own browser tab and lost on refresh.
export const reportViolation = async (
  attemptId: string,
  violationType: 'tab_switch' | 'copy_paste' | 'multiple_faces' | 'no_face' | 'other',
  detail?: string
): Promise<void> => {
  const [examId, sessionId] = attemptId.split(':')
  try {
    await apiClient.post(`/api/assessments/${examId}/violations`, {
      session_id: sessionId,
      violation_type: violationType,
      detail,
    })
  } catch {
    // best-effort
  }
}

export const submitExamAttempt = async (
  attemptId: string,
  payload: SubmitExamRequest
): Promise<SubmitExamResponse> => {
  const [examId, sessionId] = attemptId.split(':')
  const response = await apiClient.post(`/api/assessments/${examId}/submit`, {
    session_id: sessionId,
    answers: payload.answers.map((a) => ({
      question_id: Number(a.question_id),
      selected_option: a.selected_option_id ?? '',
    })),
  })
  const data = response.data
  return mapSubmitResponse(attemptId, examId, data)
}

function mapReviewItems(items: any[] | undefined) {
  return (items ?? []).map((r: any) => ({
    question_id: String(r.question_id),
    question_text: r.question_text,
    question_image_url: r.question_image_url ?? null,
    explanation: r.explanation ?? null,
    video_url: null,
    selected_option_id: r.selected_option_id ?? null,
    correct_option_id: r.correct_option_id,
    is_correct: r.is_correct,
    options: (r.options ?? []).map((o: any) => ({
      id: o.id,
      option_text: o.option_text,
      option_image_url: o.option_image_url ?? null,
      order_number: o.order_number,
    })),
  }))
}

// assessment_service /submissions/{id}/review — used by My Results and by
// admins viewing a student's attempt.
export function mapAttemptReview(data: any) {
  return {
    attempt_id: String(data.attempt_id),
    marks_obtained: data.marks_obtained,
    total_questions: data.total_questions,
    time_taken_seconds: data.time_taken_seconds ?? 0,
    submitted_at: data.submitted_at,
    score: data.score,
    passed: data.passed,
    review: mapReviewItems(data.review),
    ranking: {
      exam_id: String(data.ranking.exam_id),
      course_id: String(data.ranking.course_id),
      exam_title: data.ranking.exam_title ?? '',
      course_title: data.ranking.course_title ?? '',
      subject: data.ranking.subject ?? '',
      overall_rank: data.ranking.overall_rank ?? null,
      district_rank: data.ranking.district_rank ?? null,
    },
  }
}

function mapSubmitResponse(attemptId: string, examId: string, data: any): SubmitExamResponse {
  return {
    attempt_id: attemptId,
    new_badges: (data.new_badges ?? []).map((b: any) => ({ ...b, id: String(b.id) })),
    marks_obtained: data.correct_count,
    total_questions: data.total_questions,
    time_taken_seconds: data.time_taken_seconds ?? 0,
    review: mapReviewItems(data.review),
    ranking: {
      exam_id: examId,
      course_id: data.ranking?.course_id != null ? String(data.ranking.course_id) : '',
      exam_title: data.ranking?.exam_title ?? '',
      course_title: '',
      subject: '',
      overall_rank: data.ranking?.overall_rank ?? null,
      district_rank: data.ranking?.district_rank ?? null,
    },
  }
}

// Re-fetches a student's own last graded attempt — backs the ?view=results
// deep link (e.g. from a "My Results" list) without needing the original
// submit response to still be around client-side.
export const getLastAttempt = async (examId: string): Promise<SubmitExamResponse | null> => {
  try {
    const response = await apiClient.get(`/api/assessments/${examId}/my-last-attempt`)
    return mapSubmitResponse(`${examId}:`, examId, response.data)
  } catch {
    return null
  }
}

export interface LeaderboardEntry {
  rank: number
  district_rank: number
  full_name: string
  school: string
  district: string
  grade: number
  score: number
  time_taken_seconds: number
  attempts: number
  is_current_user: boolean
}

// Rankings are per exam, from each student's first attempt (assessment_service).
export const getExamRanking = async (examId: string): Promise<ExamRankResponse> => {
  const response = await apiClient.get(`/api/assessments/rankings/exam/${examId}`)
  return response.data
}

export const getMyAttempts = async (limit = 10): Promise<MyAttemptItem[]> => {
  const response = await apiClient.get('/api/assessments/my-submissions', { params: { limit } })
  return response.data.map((a: any) => ({
    ...a,
    attempt_id: String(a.attempt_id),
    exam_id: String(a.exam_id),
    course_id: a.course_id != null ? String(a.course_id) : null,
    sub_course_id: a.sub_course_id != null ? String(a.sub_course_id) : null,
  }))
}

export interface RankingExam {
  exam_id: string
  exam_title: string
  course_title: string
  subject: string
}

// Public: exams that have been attempted (only the caller's own when signed in as a student).
export const getRankingExams = async (): Promise<RankingExam[]> => {
  const response = await apiClient.get('/api/assessments/rankings/exams')
  return response.data
}

export const getRankingsLeaderboard = async (
  exam_id: string,
  district?: string,
  limit = 50,
  offset = 0
): Promise<LeaderboardEntry[]> => {
  const response = await apiClient.get('/api/assessments/rankings/leaderboard', {
    params: { exam_id, district: district || undefined, limit, offset },
  })
  return response.data
}


export interface TopCourse {
  id: string
  title: string
  subject: string
  grade: number
  image_url: string | null
  price: number
  enrollment_count: number
  stream_ids?: string[]
}

export interface PlatformStats {
  total_students: number
  total_courses: number
  total_exams: number
  total_attempts: number
  top_courses: TopCourse[]
}

// Public, aggregated by analytics_service from the owning services.
export const getPlatformStats = async (): Promise<PlatformStats> => {
  const response = await apiClient.get('/api/analytics/platform-stats')
  return response.data
}

export const getSubjects = async (grade?: number, stream_id?: string | null): Promise<string[]> => {
  if (grade === undefined || grade === null) return []
  const response = await apiClient.get('/api/users/subjects', {
    params: { grade, stream_id: stream_id || undefined },
  })
  return response.data
}

export interface ReferralSummary {
  referral_code: string
  referral_link: string
  wallet_credits: number
  total_credits_earned: number
  total_successful_referrals: number
}

export interface ReferralEventItem {
  event_id: string
  referred_student_id: string
  referred_student_name: string
  referred_student_school: string
  credit_amount: number
  status: string
  created_at: string | null
  credited_at: string | null
}

export interface ReferralEventListResponse {
  events: ReferralEventItem[]
}

export const getReferralSummary = async (): Promise<ReferralSummary> => {
  const response = await apiClient.get('/api/users/referral/summary')
  return response.data
}

export const getReferralEvents = async (limit = 50): Promise<ReferralEventListResponse> => {
  const response = await apiClient.get('/api/users/referral/events', { params: { limit } })
  return response.data
}

// Credit goes to the referrer when this student first enrolls, not now.
export const applyReferralCode = async (
  referralCode: string
): Promise<{ message: string; credit_amount: number }> => {
  const response = await apiClient.post('/api/users/referral/apply', { referral_code: referralCode.trim() })
  return { message: response.data.message, credit_amount: 0 }
}

export interface Stream {
  id: string
  name: string
  subjects: string[]
  description: string | null
  is_active: boolean
}

export const getStreams = async (): Promise<Stream[]> => {
  const response = await apiClient.get('/api/users/streams')
  return response.data.map((s: any) => ({
    id: String(s.id),
    name: s.name,
    subjects: s.subjects,
    description: s.description ?? null,
    is_active: s.is_active,
  }))
}

export const getMyProgress = async (): Promise<StudentProgressData> => {
  const response = await apiClient.get('/api/analytics/me/progress')
  return response.data
}

export const fetchAttemptReview = async (attemptId: string): Promise<any> => {
  const response = await apiClient.get(`/api/assessments/submissions/${attemptId}/review`)
  return mapAttemptReview(response.data)
}

// The overview already carries lessons → videos/materials with each video's
// completed state from progress_service.
export const getVideoClassDetails = async (courseId: string): Promise<Course> => {
  return getCourseOverview(courseId)
}

export const updateVideoProgress = async (data: {
  course_id: string
  video_id: string
  total_lessons?: number
  watch_duration_seconds?: number
  last_position_seconds?: number
}) => {
  const response = await apiClient.post(`/api/progress/courses/${data.course_id}/lessons/progress`, {
    lesson_id: Number(data.video_id),
    total_lessons: data.total_lessons,
    watch_duration_seconds: data.watch_duration_seconds ?? 0,
    last_position_seconds: data.last_position_seconds ?? 0,
  })
  return response.data
}

// ── Class Packages ──────────────────────────────────────────────────────────
// No such concept exists in Edura's course model.

export interface StudentClassPackage {
  id: string
  name: string
  description: string | null
  grade: number
  stream_id: string | null
  stream_name: string | null
  price: number
  is_enrolled: boolean
}

export interface StudentClassEnrollment {
  id: string
  class_package_id: string
  package_name: string | null
  package_grade: number | null
  package_stream_name: string | null
  status: string
  enrolled_at: string
  expires_at: string | null
}

// Filtered to the student's own grade/stream, like the course catalogue.
export const getStudentClassPackages = async (): Promise<StudentClassPackage[]> => {
  let grade: number | undefined
  let streamId: string | undefined
  const decoded = getDecodedToken()
  if (decoded?.role === 'student') {
    try {
      const profile = (await apiClient.get(`/api/users/${decoded.sub}`)).data
      grade = profile.grade ?? undefined
      streamId = profile.stream_id != null ? String(profile.stream_id) : undefined
    } catch {
      // No profile yet: show every package.
    }
  }
  const response = await apiClient.get('/api/enrollments/class-packages', {
    params: { grade, stream_id: grade && grade >= 12 ? streamId : undefined },
  })
  return response.data
}

export const enrollFreeClassPackage = async (packageId: string): Promise<StudentClassEnrollment> => {
  const response = await apiClient.post(`/api/enrollments/class-packages/${packageId}/enroll-free`)
  return response.data
}

export const getMyClassEnrollments = async (): Promise<StudentClassEnrollment[]> => {
  const response = await apiClient.get('/api/enrollments/my-class-enrollments')
  return response.data
}
