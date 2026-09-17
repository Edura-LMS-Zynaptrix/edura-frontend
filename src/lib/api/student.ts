/**
 * Student API - Course enrollment and exam access
 *
 * Edura's actual backend surface is much smaller than this file's original
 * (ExamBuddy) shape: no sub-courses, streams, class-packages, referrals, or
 * bulk "my enrollments/attempts" listings. Every export below is kept with
 * its original name/signature so pages and Redux slices compile unchanged;
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
    grade: 0,
    image_url: c.thumbnail_url ?? null,
    description: c.description ?? null,
    price: Number(c.price ?? 0),
    is_active: c.status === 'PUBLISHED',
    course_type: 'video',
    modules: [],
  }
}

export const getAvailableCourses = async (): Promise<Course[]> => {
  const response = await apiClient.get('/api/courses/')
  const items = response.data?.items ?? []
  return items.map(mapCourse)
}

export const getCourseOverview = async (courseId: string): Promise<Course> => {
  const [courseRes, modulesRes] = await Promise.all([
    apiClient.get(`/api/courses/${courseId}`),
    apiClient.get(`/api/courses/${courseId}/modules`),
  ])
  const course = mapCourse(courseRes.data)

  const modules: VideoModule[] = await Promise.all(
    modulesRes.data.map(async (m: any) => {
      let lessons: any[] = []
      try {
        const lessonsRes = await apiClient.get(`/api/courses/${courseId}/modules/${m.id}/lessons`)
        lessons = lessonsRes.data
      } catch {
        lessons = []
      }
      const videos: VideoLesson[] = lessons.map((l: any) => ({
        id: String(l.id),
        module_id: String(m.id),
        title: l.title,
        description: null,
        yt_video_id: l.youtube_video_id ?? '',
        duration_seconds: l.duration_seconds ?? 0,
        order_number: l.order ?? 0,
        is_published: true,
        is_completed: false,
        watched_percentage: 0,
      }))
      return {
        id: String(m.id),
        title: m.title,
        description: null,
        image_url: null,
        order_number: m.order ?? 0,
        is_active: true,
        videos,
        materials: [],
        video_count: videos.length,
      }
    })
  )

  course.modules = modules
  return course
}

export const getCourseExams = async (courseId: string): Promise<ExamWithAccess[]> => {
  const decoded = getDecodedToken()
  const response = await apiClient.get('/api/assessments/', { params: { course_id: courseId } })

  let isEnrolled = true
  if (decoded?.role === 'student') {
    try {
      const enrollRes = await apiClient.get('/api/enrollments', {
        params: { student_id: decoded.sub, course_id: courseId },
      })
      isEnrolled = enrollRes.data?.status === 'ACTIVE'
    } catch {
      isEnrolled = false
    }
  }

  return response.data.map((a: any) => ({
    id: String(a.id),
    title: a.title,
    description: a.description ?? null,
    image_url: null,
    duration_minutes: a.time_limit_minutes ?? 0,
    total_questions: 0, // not known until the session starts
    is_free: false,
    is_enrolled: isEnrolled,
    enrollment_type: isEnrolled ? 'course' : null,
    already_attempted: false, // assessment_service has no "my submissions" lookup
    last_score: null,
    last_total: null,
    scheduled_start: null,
  }))
}

// No sub-course concept exists in Edura.
export const getSubCourseExams = async (_subCourseId: string): Promise<ExamWithAccess[]> => {
  return []
}

// ── Enrollment ───────────────────────────────────────────────────────────
// enrollment_service only creates enrollments asynchronously in reaction to a
// successful payment (via RabbitMQ) — there is no direct "enroll for free"
// endpoint to call.

export const enrollFreeSubCourse = async (_subCourseId: string): Promise<EnrollmentResponse> => {
  throw new Error('Free enrollment is not supported — enrollment is created automatically after a successful payment.')
}

export const enrollFreeCourse = async (_courseId: string): Promise<EnrollmentResponse> => {
  throw new Error('Free enrollment is not supported — enrollment is created automatically after a successful payment.')
}

export const enrollFreeVideoCourse = async (_courseId: string): Promise<EnrollmentResponse> => {
  throw new Error('Free enrollment is not supported — enrollment is created automatically after a successful payment.')
}

export const enrollFreeVideoModule = async (_moduleId: string): Promise<EnrollmentResponse> => {
  throw new Error('Free enrollment is not supported — enrollment is created automatically after a successful payment.')
}

// enrollment_service can only answer "is this student enrolled in this
// specific course" (student_id + course_id) — there's no bulk listing
// endpoint. We approximate "my enrollments" by checking each published
// course against that lookup.
export const getMyEnrollments = async (_offset = 0, _limit = 50): Promise<MyEnrollmentsResponse> => {
  const decoded = getDecodedToken()
  const empty: MyEnrollmentsResponse = { courses: [], sub_courses: [], modules: [], exams: [] }
  if (!decoded) return empty

  const courses = await getAvailableCourses()
  const checks = await Promise.all(
    courses.map(async (c) => {
      try {
        const res = await apiClient.get('/api/enrollments', {
          params: { student_id: decoded.sub, course_id: c.id },
        })
        return res.data?.status === 'ACTIVE' ? { course: c, enrollment: res.data } : null
      } catch {
        return null
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

// Edura has no dedicated access-check endpoint, but fetching the assessment
// itself (real call) gives enough to populate the pre-exam preview; there's
// no separate "locked" concept, so is_locked is always false.
export const checkExamAccess = async (examId: string) => {
  const res = await apiClient.get(`/api/assessments/${examId}`)
  return {
    has_access: true,
    is_locked: false,
    lock_message: null as string | null,
    lock_reason: null as string | null,
    exam: {
      title: res.data.title as string,
      duration_minutes: (res.data.time_limit_minutes as number) ?? 0,
      total_questions: 0, // not known until the session starts
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
      question_image_url: null,
      explanation: null,
      order_number: q.position,
      // Edura submits answers by option text, not a stable option id — use
      // the text itself as the id so the exam UI's selection model still works.
      options: optionTexts.map((text, idx) => ({
        id: text,
        option_text: text,
        option_image_url: null,
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

  return {
    attempt_id: attemptId,
    marks_obtained: data.correct_count,
    total_questions: data.total_questions,
    time_taken_seconds: 0,
    review: [],
    ranking: {
      exam_id: examId,
      course_id: '',
      exam_title: '',
      course_title: '',
      subject: '',
      overall_rank: null,
      district_rank: null,
    },
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

// Resolve an assessment_id to its parent course_id (progress_service's
// leaderboard is keyed by course, not by individual assessment).
async function resolveAssessmentCourse(examId: string): Promise<{ courseId: string; title: string }> {
  const res = await apiClient.get(`/api/assessments/${examId}`)
  return { courseId: String(res.data.course_id), title: res.data.title }
}

export const getExamRanking = async (examId: string): Promise<ExamRankResponse> => {
  const decoded = getDecodedToken()
  const { courseId, title } = await resolveAssessmentCourse(examId)
  const res = await apiClient.get(`/api/progress/courses/${courseId}/leaderboard`)
  const mine = decoded ? res.data.find((r: any) => String(r.student_id) === decoded.sub) : null

  return {
    exam_id: examId,
    course_id: courseId,
    exam_title: title,
    course_title: '',
    subject: '',
    overall_rank: mine ? mine.rank : null,
    district_rank: null,
  }
}

export const getMyAttempts = async (_limit = 10): Promise<MyAttemptItem[]> => {
  // assessment_service has no "list my submissions" endpoint.
  return []
}

export interface RankingExam {
  exam_id: string
  exam_title: string
  course_title: string
  subject: string
}

// No single endpoint enumerates assessments across every course, so this
// composes one from the two real endpoints that do exist: list published
// courses, then list each course's published assessments.
export const getRankingExams = async (): Promise<RankingExam[]> => {
  const courses = await getAvailableCourses()
  const perCourse = await Promise.all(
    courses.map(async (c) => {
      try {
        const res = await apiClient.get('/api/assessments/', { params: { course_id: c.id } })
        return res.data.map((a: any) => ({
          exam_id: String(a.id),
          exam_title: a.title,
          course_title: c.title,
          subject: c.subject,
        }))
      } catch {
        return []
      }
    })
  )
  return perCourse.flat()
}

export const getRankingsLeaderboard = async (
  exam_id: string,
  _district?: string,
  limit = 50,
  _offset = 0
): Promise<LeaderboardEntry[]> => {
  const decoded = getDecodedToken()
  const { courseId } = await resolveAssessmentCourse(exam_id)
  const res = await apiClient.get(`/api/progress/courses/${courseId}/leaderboard`)
  return res.data.slice(0, limit).map((row: any) => ({
    rank: row.rank,
    district_rank: 0,
    full_name: `Student #${row.student_id}`,
    school: '',
    district: '',
    grade: 0,
    score: row.points,
    time_taken_seconds: 0,
    attempts: 0,
    is_current_user: decoded ? String(row.student_id) === decoded.sub : false,
  }))
}

export const getLastAttempt = async (_examId: string) => {
  // assessment_service has no "last attempt" lookup endpoint.
  return null
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

export const getPlatformStats = async (): Promise<PlatformStats> => {
  // analytics_service is an empty stub in Edura today.
  return { total_students: 0, total_courses: 0, total_exams: 0, total_attempts: 0, top_courses: [] }
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
  throw new Error('Referrals are not supported by the Edura backend.')
}

export const getReferralEvents = async (_limit = 50): Promise<ReferralEventListResponse> => {
  return { events: [] }
}

export const applyReferralCode = async (
  _referralCode: string
): Promise<{ message: string; credit_amount: number }> => {
  throw new Error('Referrals are not supported by the Edura backend.')
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
  throw new Error('Aggregate progress analytics are not supported by the Edura backend — see per-course progress instead.')
}

export const fetchAttemptReview = async (_attemptId: string): Promise<any> => {
  throw new Error('Attempt review is not supported by the Edura backend yet.')
}

// Video Classes — reuses the same real course_service + content_service data
// as getCourseOverview (Edura doesn't distinguish "exam courses" from "video
// classes"; every course exposes whatever modules/lessons it has).
export const getVideoClassDetails = async (courseId: string): Promise<Course> => {
  return getCourseOverview(courseId)
}

export const updateVideoProgress = async (data: {
  video_id: string
  is_completed: boolean
  watched_percentage: number
}) => {
  // progress_service only updates lesson-watched state via a RabbitMQ event
  // published elsewhere — there's no direct REST endpoint for the frontend to
  // call, so this only updates local UI state (echoed back) rather than
  // persisting anything server-side.
  return data
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

export const getStudentClassPackages = async (): Promise<StudentClassPackage[]> => {
  return []
}

export const enrollFreeClassPackage = async (_packageId: string): Promise<StudentClassEnrollment> => {
  throw new Error('Class packages are not supported by the Edura backend.')
}

export const getMyClassEnrollments = async (): Promise<StudentClassEnrollment[]> => {
  return []
}
