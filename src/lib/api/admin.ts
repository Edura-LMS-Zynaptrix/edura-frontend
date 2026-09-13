/**
 * Admin API Client
 *
 * Edura's admin_service and analytics_service are empty stubs today, and
 * assessment_service has no admin CRUD at all (only get/start/submit). Real
 * course + module + lesson management lives in course_service, file uploads
 * in content_service, users in user_service, payments in payment_service.
 * Every export below keeps its original name/signature; those with a real
 * backing endpoint call it (with field translation), the rest return an
 * empty default or reject clearly — never a fabricated network call.
 */
import apiClient from './client'
import * as paymentApi from './payment'

// ── Types (unchanged from the original ExamBuddy shape) ─────────────────────

export interface AdminActivityItem {
  type: 'student' | 'payment' | 'exam'
  title: string
  subtitle: string
  timestamp: string | null
}

export interface AdminStats {
  total_students: number
  total_courses: number
  total_exams: number
  total_exam_attempts: number
  total_revenue: number
  revenue_this_month: number
  pending_bank_slips: number
  recent_activity: AdminActivityItem[]
}

export interface SubCourseCreateData {
  course_id: string
  title: string
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
  order_number: number
  is_active?: boolean
}

export interface SubCourseUpdateData {
  title?: string
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
  order_number?: number
  is_active?: boolean
}

export interface ExamCreateData {
  course_id: string
  sub_course_id?: string | null
  title: string
  image_url?: string | null
  image_public_id?: string | null
  description?: string | null
  duration_minutes: number
  total_questions: number
  price: number
  scheduled_start?: string | null
  order_number: number
  is_published: boolean
}

export interface ExamUpdateData {
  course_id?: string | null
  sub_course_id?: string | null
  title?: string
  image_url?: string | null
  image_public_id?: string | null
  description?: string | null
  duration_minutes?: number
  total_questions?: number
  price?: number
  scheduled_start?: string | null
  order_number?: number
  is_published?: boolean
}

export interface QuestionOptionCreateData {
  option_text?: string | null
  option_image_url?: string | null
  option_image_public_id?: string | null
  is_correct: boolean
  order_number: number
}

export interface QuestionCreateData {
  exam_id: string
  question_text: string
  question_image_url?: string | null
  question_image_public_id?: string | null
  explanation?: string | null
  video_url?: string | null
  order_number: number
  options: QuestionOptionCreateData[]
}

export interface QuestionUpdateData {
  question_text?: string
  question_image_url?: string | null
  question_image_public_id?: string | null
  explanation?: string | null
  video_url?: string | null
  order_number?: number
  options?: any[]
}

export interface ModuleCreateData {
  course_id: string
  title: string
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
  order_number: number
  is_active?: boolean
}

export interface ModuleUpdateData {
  title?: string
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
  order_number?: number
  is_active?: boolean
}

export interface VideoCreateData {
  module_id: string
  title: string
  description?: string | null
  yt_video_id: string
  duration_seconds: number
  order_number: number
  is_published: boolean
}

export interface VideoUpdateData {
  title?: string
  description?: string | null
  yt_video_id?: string
  duration_seconds?: number
  order_number?: number
  is_published?: boolean
}

export interface MaterialCreateData {
  module_id: string
  title: string
  file_url: string
  file_type: string
  file_public_id?: string | null
  order_number: number
}

export interface MaterialUpdateData {
  title?: string
  file_url?: string
  file_type?: string
  file_public_id?: string | null
  order_number?: number
}

// ── Stats (derived client-side — admin_service/analytics_service are stubs) ─

export const getAdminStats = async (): Promise<AdminStats> => {
  const [coursesRes, paymentsRes] = await Promise.all([
    apiClient.get('/api/courses/'),
    paymentApi.getAllPayments().catch(() => []),
  ])
  const successPayments = paymentsRes.filter((p) => p.status === 'success')
  const now = new Date()
  const revenueThisMonth = successPayments
    .filter((p) => {
      const d = new Date(p.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, p) => sum + p.amount, 0)

  return {
    total_students: 0, // user_service's list endpoint doesn't filter by role
    total_courses: coursesRes.data?.total ?? 0,
    total_exams: 0, // no endpoint enumerates assessments across courses
    total_exam_attempts: 0,
    total_revenue: successPayments.reduce((sum, p) => sum + p.amount, 0),
    revenue_this_month: revenueThisMonth,
    pending_bank_slips: 0,
    recent_activity: [],
  }
}

// Students Management (real: user_service)

export interface AdminStudent {
  user_id: string
  email: string
  is_active: boolean
  needs_profile_completion: boolean
  joined_at: string | null
  full_name: string
  phone_number: string
  parent_phone_number: string | null
  school: string
  district: string
  grade: number
  nic_number: string | null
  profile_photo_url: string | null
  enrollment_count: number
  attempt_count: number
  referral_code: string | null
  referred_by_code: string | null
  wallet_credits: number
  successful_referrals: number
  total_referral_credits: number
}

export interface AdminStudentsResponse {
  total: number
  students: AdminStudent[]
}

function mapProfileToAdminStudent(p: any): AdminStudent {
  return {
    user_id: String(p.id),
    email: p.email ?? '',
    is_active: true,
    needs_profile_completion: false,
    joined_at: p.created_at,
    full_name: p.name,
    phone_number: p.mobile_no ?? '',
    parent_phone_number: null,
    school: '',
    district: '',
    grade: 0,
    nic_number: null,
    profile_photo_url: p.avatar_url ?? null,
    enrollment_count: 0,
    attempt_count: 0,
    referral_code: null,
    referred_by_code: null,
    wallet_credits: 0,
    successful_referrals: 0,
    total_referral_credits: 0,
  }
}

export const getAdminStudents = async (params?: {
  search?: string
  grade?: number
  district?: string
  is_active?: boolean
  skip?: number
  limit?: number
}): Promise<AdminStudentsResponse> => {
  const page = params?.skip ? Math.floor(params.skip / (params.limit ?? 20)) + 1 : 1
  const response = await apiClient.get('/api/users/', {
    params: { page, page_size: params?.limit ?? 20 },
  })
  let students = response.data.items.map(mapProfileToAdminStudent)
  if (params?.search) {
    const q = params.search.toLowerCase()
    students = students.filter(
      (s: AdminStudent) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    )
  }
  return { total: response.data.total, students }
}

// user_service has no is_active toggle on a profile (that flag lives on
// auth_service's User row, with no endpoint to change it either).
export const toggleStudentActive = async (_userId: string): Promise<{ user_id: string; is_active: boolean }> => {
  throw new Error('Activating/deactivating users is not supported by the Edura backend yet.')
}

export const deleteStudent = async (userId: string): Promise<{ message: string }> => {
  await apiClient.delete(`/api/users/${userId}`)
  return { message: 'User profile deleted' }
}

// Student Progress Analytics

export interface ExamAttemptDetail {
  id: string
  attempt_number: number
  score_pct: number
  marks_obtained: number
  total_questions: number
  time_seconds: number
  submitted_at: string | null
  status: 'passed' | 'failed'
}

export interface StudentProgressData {
  student: {
    full_name: string
    grade: number
    school: string
    district: string
    badges_count: number
    phone_number: string
    parent_phone_number: string | null
  }
  overall: {
    total_unique_exams: number
    unique_exams_attempted: number
    total_attempts_made: number
    completion_pct: number
    avg_score_pct: number
    avg_time_seconds: number
  }
  subjects: {
    subject: string
    course_title: string
    total_exams: number
    attempted_exams: number
    total_attempts_count: number
    avg_score_pct: number
    best_score_pct: number
    avg_time_seconds: number
    score_trend: number[]
    time_trend: number[]
    exams: {
      id: string
      title: string
      order_number: number
      best_score_pct: number
      attempts_count: number
      latest_score_pct: number
      history: ExamAttemptDetail[]
    }[]
  }[]
}

export interface StudentProgressSummary {
  user_id: string
  full_name: string
  completion_pct: number
  avg_score_pct: number
}

// progress_service's dashboard is keyed by (student, course), not by student
// alone — this aggregate, cross-course shape has no equivalent endpoint.
export const getStudentProgress = async (_userId: string): Promise<StudentProgressData> => {
  throw new Error('Aggregate student progress analytics are not supported by the Edura backend yet.')
}

export const getAllStudentsProgressSummary = async (): Promise<StudentProgressSummary[]> => {
  return []
}

export const sendStudentReportDetail = async (_userId: string): Promise<{ message: string }> => {
  throw new Error('Report generation is not supported by the Edura backend yet.')
}

export const fetchStudentAttemptReview = async (_userId: string, _attemptId: string): Promise<any> => {
  throw new Error('Attempt review is not supported by the Edura backend yet.')
}

// Analytics — analytics_service is an empty stub in Edura today.

export interface AnalyticsData {
  revenue_by_month: { year: number; month: number; revenue: number; count: number }[]
  students_by_grade: { grade: number; count: number }[]
  students_by_district: { district: string; count: number }[]
  attempts_by_month: { year: number; month: number; count: number }[]
  top_exams: { exam_id: string; title: string; subject: string; grade: number; attempt_count: number; avg_score: number }[]
  enrollments_by_subject: { subject: string; count: number }[]
}

export interface StrugglePerformanceItem {
  id: string
  title: string
  type: 'exam' | 'subcourse'
  avg_score: number
  failure_rate: number
  total_students: number
  attempt_count: number
}

export interface CourseStruggleResponse {
  course_id: string
  overall_avg_score: number
  overall_failure_rate: number
  struggling_modules: StrugglePerformanceItem[]
  hardest_exams: StrugglePerformanceItem[]
}

export const getAdminAnalytics = async (): Promise<AnalyticsData> => {
  return {
    revenue_by_month: [],
    students_by_grade: [],
    students_by_district: [],
    attempts_by_month: [],
    top_exams: [],
    enrollments_by_subject: [],
  }
}

export const getCourseStruggleAnalysis = async (_courseId: string): Promise<CourseStruggleResponse> => {
  throw new Error('Struggle analysis is not supported by the Edura backend yet.')
}

// Rankings (real, when an exam_id is given — resolved via progress_service)

export interface AdminRankingRow {
  island_rank: number
  district_rank: number
  user_id: string
  full_name: string
  district: string
  grade: number
  school: string
  subject: string
  total_marks: number
  total_questions: number
  score_pct: number
  time_taken_seconds: number
  attempt_count: number
}

export interface AdminExamFilter {
  exam_id: string
  exam_title: string
  course_title: string
  subject: string
}

export interface AdminRankingsResponse {
  rankings: AdminRankingRow[]
  exams: AdminExamFilter[]
}

export const getAdminRankings = async (params?: {
  exam_id?: string
  district?: string
  limit?: number
}): Promise<AdminRankingsResponse> => {
  if (!params?.exam_id) {
    // No endpoint enumerates assessments across courses, so there's nothing
    // to list until a specific exam is chosen.
    return { rankings: [], exams: [] }
  }
  const assessmentRes = await apiClient.get(`/api/assessments/${params.exam_id}`)
  const courseId = assessmentRes.data.course_id
  const leaderboardRes = await apiClient.get(`/api/progress/courses/${courseId}/leaderboard`)
  const rankings: AdminRankingRow[] = leaderboardRes.data.slice(0, params.limit ?? 50).map((row: any) => ({
    island_rank: row.rank,
    district_rank: 0,
    user_id: String(row.student_id),
    full_name: `Student #${row.student_id}`,
    district: '',
    grade: 0,
    school: '',
    subject: '',
    total_marks: row.points,
    total_questions: 0,
    score_pct: 0,
    time_taken_seconds: 0,
    attempt_count: 0,
  }))
  return {
    rankings,
    exams: [{ exam_id: params.exam_id, exam_title: assessmentRes.data.title, course_title: '', subject: '' }],
  }
}

// Stream Management — no such concept exists in Edura.

export interface AdminStream {
  id: string
  name: string
  subjects: string[]
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface StreamCreateData {
  name: string
  subjects: string[]
  description?: string
}

export interface StreamUpdateData {
  name?: string
  subjects?: string[]
  description?: string
  is_active?: boolean
}

export const getStreams = async (): Promise<AdminStream[]> => {
  return []
}

export const getStream = async (_id: string): Promise<AdminStream> => {
  throw new Error('Streams are not supported by the Edura backend.')
}

export const createStream = async (_data: StreamCreateData): Promise<AdminStream> => {
  throw new Error('Streams are not supported by the Edura backend.')
}

export const updateStream = async (_id: string, _data: StreamUpdateData): Promise<AdminStream> => {
  throw new Error('Streams are not supported by the Edura backend.')
}

export const deleteStream = async (_id: string): Promise<void> => {
  throw new Error('Streams are not supported by the Edura backend.')
}

// Grade Subject Management — no such concept exists in Edura.

export interface GradeSubject {
  id: string
  name: string
  grade: number
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export const getGradeSubjects = async (_grade?: number): Promise<GradeSubject[]> => {
  return []
}

export const createGradeSubject = async (_data: { name: string; grade: number; is_active?: boolean }): Promise<GradeSubject> => {
  throw new Error('Grade subjects are not supported by the Edura backend.')
}

export const updateGradeSubject = async (_id: string, _data: { name?: string; is_active?: boolean }): Promise<GradeSubject> => {
  throw new Error('Grade subjects are not supported by the Edura backend.')
}

export const deleteGradeSubject = async (_id: string): Promise<void> => {
  throw new Error('Grade subjects are not supported by the Edura backend.')
}

// Course Management (real: course_service)

function mapAdminCourse(c: any): any {
  return {
    id: String(c.id),
    title: c.title,
    subject: '',
    grade: 0,
    course_type: 'video',
    image_url: c.thumbnail_url ?? null,
    price: Number(c.price ?? 0),
    description: c.description ?? null,
    is_active: c.status === 'PUBLISHED',
    stream_ids: [],
  }
}

export const getCourses = async () => {
  const response = await apiClient.get('/api/courses/')
  return response.data.items.map(mapAdminCourse)
}

export const createCourse = async (data: {
  title: string
  subject: string
  grade: number
  course_type: 'exam' | 'video'
  price: number
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
  stream_ids?: string[]
}) => {
  const response = await apiClient.post('/api/courses/', {
    title: data.title,
    description: data.description,
    price: data.price,
    thumbnail_url: data.image_url,
  })
  return mapAdminCourse(response.data)
}

export const updateCourse = async (id: string, data: {
  title?: string
  subject?: string
  grade?: number
  course_type?: 'exam' | 'video'
  price?: number
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
  stream_ids?: string[]
}) => {
  const response = await apiClient.put(`/api/courses/${id}`, {
    title: data.title,
    description: data.description,
    price: data.price,
    thumbnail_url: data.image_url,
  })
  return mapAdminCourse(response.data)
}

export const deleteCourse = async (id: string) => {
  await apiClient.delete(`/api/courses/${id}`)
  return { message: 'Course deleted' }
}

// Sub-Course Management — Edura has no exam-grouping construct under a
// course (only modules, which group video lessons — see Video Classes below).
export const getSubCourses = async (_courseId?: string) => {
  return []
}

export const createSubCourse = async (_data: SubCourseCreateData): Promise<any> => {
  throw new Error('Sub-courses are not supported by the Edura backend.')
}

export const updateSubCourse = async (_id: string, _data: SubCourseUpdateData): Promise<any> => {
  throw new Error('Sub-courses are not supported by the Edura backend.')
}

export const deleteSubCourse = async (_id: string): Promise<any> => {
  throw new Error('Sub-courses are not supported by the Edura backend.')
}

// Exam Management (real: assessment_service)

function mapAdminExam(a: any): any {
  return {
    id: String(a.id),
    course_id: String(a.course_id),
    sub_course_id: null,
    title: a.title,
    image_url: null,
    description: a.description ?? null,
    duration_minutes: a.time_limit_minutes ?? 0,
    total_questions: 0, // not tracked on the assessment itself
    price: 0, // exams aren't priced separately from their course in Edura
    order_number: 0,
    scheduled_start: null,
    is_published: a.is_published,
  }
}

export const getExams = async (courseId?: string) => {
  if (!courseId) return []
  const response = await apiClient.get('/api/assessments/', { params: { course_id: courseId } })
  return response.data.map(mapAdminExam)
}

export const createExam = async (data: ExamCreateData): Promise<any> => {
  const response = await apiClient.post('/api/assessments/', {
    course_id: Number(data.course_id),
    title: data.title,
    description: data.description,
    assessment_type: 'exam',
    time_limit_minutes: data.duration_minutes,
    is_published: data.is_published,
  })
  return mapAdminExam(response.data)
}

export const updateExam = async (id: string, data: ExamUpdateData): Promise<any> => {
  const response = await apiClient.put(`/api/assessments/${id}`, {
    title: data.title,
    description: data.description,
    time_limit_minutes: data.duration_minutes,
    is_published: data.is_published,
  })
  return mapAdminExam(response.data)
}

export interface ZipUploadResult {
  applied: number
  skipped: number
  errors: string[]
  message: string
}

export const uploadQuestionImagesZip = async (_examId: string, _file: File): Promise<ZipUploadResult> => {
  throw new Error('Bulk question image upload is not supported by the Edura backend yet.')
}

export const deleteExam = async (id: string): Promise<any> => {
  await apiClient.delete(`/api/assessments/${id}`)
  return { message: 'Exam deleted' }
}

// Image / File Management (real: content_service, teacher/admin only)

export const uploadImage = async (file: File, _entity: string) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post('/api/content/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  // Callers use either the image_* or file_* field names depending on
  // context — content_service's /upload endpoint serves both use cases.
  return {
    url: response.data.secure_url as string,
    public_id: response.data.public_id as string,
    image_url: response.data.secure_url as string,
    image_public_id: response.data.public_id as string,
    file_url: response.data.secure_url as string,
    file_public_id: response.data.public_id as string,
    file_type: response.data.mime_type as string,
  }
}

export const deleteImage = async (_publicId: string): Promise<any> => {
  throw new Error('Deleting uploaded assets is not supported by the Edura backend yet.')
}

export const uploadFile = async (file: File, entity: string = 'materials') => {
  return uploadImage(file, entity)
}

// Question Management (real: assessment_service)

function mapAdminQuestion(q: any): any {
  const options = (q.options as string[]) ?? []
  return {
    id: String(q.id),
    exam_id: String(q.assessment_id),
    question_text: q.question_text,
    question_image_url: null,
    question_image_public_id: null,
    explanation: null,
    video_url: null,
    order_number: q.position,
    options: options.map((text: string, idx: number) => ({
      id: `${q.id}-${idx}`,
      option_text: text,
      option_image_url: null,
      option_image_public_id: null,
      is_correct: text === q.correct_answer,
      order_number: idx,
    })),
  }
}

export const getQuestions = async (examId: string) => {
  const response = await apiClient.get(`/api/assessments/${examId}/questions`)
  return response.data.map(mapAdminQuestion)
}

export const getQuestion = async (_id: string): Promise<any> => {
  throw new Error('Fetching a single question by id is not supported — list questions for its exam instead.')
}

export const createQuestion = async (data: QuestionCreateData): Promise<any> => {
  const response = await apiClient.post(`/api/assessments/${data.exam_id}/questions`, {
    question_text: data.question_text,
    question_type: 'mcq',
    options: data.options.map((o) => ({ option_text: o.option_text ?? '', is_correct: o.is_correct })),
    marks: 1,
    position: data.order_number,
  })
  return mapAdminQuestion(response.data)
}

export const updateQuestion = async (id: string, data: QuestionUpdateData): Promise<any> => {
  const response = await apiClient.put(`/api/assessments/questions/${id}`, {
    question_text: data.question_text,
    options: data.options?.map((o: any) => ({ option_text: o.option_text ?? '', is_correct: o.is_correct })),
    position: data.order_number,
  })
  return mapAdminQuestion(response.data)
}

export const deleteQuestion = async (id: string): Promise<any> => {
  await apiClient.delete(`/api/assessments/questions/${id}`)
  return { message: 'Question deleted' }
}

export const importQuestionsCSV = async (_examId: string, _file: File): Promise<any> => {
  throw new Error('CSV question import is not supported by the Edura backend yet.')
}

// Bulk exam import — not supported.

export interface BulkImportExamDetail {
  folder: string
  title: string
  exam_id: string
  questions_created: number
  images_applied: number
  warnings: string[] | null
}

export interface BulkImportResult {
  created_exams: number
  total_questions_created: number
  skipped_exams: number
  details: BulkImportExamDetail[]
  errors: { exam: string; message: string }[]
}

export const bulkImportExams = async (
  _courseId: string,
  _subCourseId: string,
  _file: File,
): Promise<BulkImportResult> => {
  throw new Error('Bulk exam import is not supported by the Edura backend yet.')
}

export const downloadBulkImportTemplate = async (): Promise<void> => {
  throw new Error('Bulk exam import is not supported by the Edura backend yet.')
}

// Video Classes Management (real: course_service modules + lessons)

export const getModules = async (courseId: string) => {
  const response = await apiClient.get(`/api/courses/${courseId}/modules`)
  return response.data
}

export const getModule = async (_moduleId: string): Promise<any> => {
  throw new Error('Fetching a single module by id is not supported — list modules for its course instead.')
}

export const createModule = async (data: ModuleCreateData) => {
  const response = await apiClient.post(`/api/courses/${data.course_id}/modules`, {
    title: data.title,
    order: data.order_number,
  })
  return response.data
}

export const updateModule = async (_id: string, _data: ModuleUpdateData): Promise<any> => {
  throw new Error('Use updateModuleForCourse(courseId, id, data) — Edura scopes modules under a course.')
}

export const updateModuleForCourse = async (courseId: string, moduleId: string, data: ModuleUpdateData) => {
  const response = await apiClient.put(`/api/courses/${courseId}/modules/${moduleId}`, {
    title: data.title,
    order: data.order_number,
  })
  return response.data
}

export const deleteModuleForCourse = async (courseId: string, moduleId: string) => {
  await apiClient.delete(`/api/courses/${courseId}/modules/${moduleId}`)
  return { message: 'Module deleted' }
}

export const getVideos = async (_moduleId: string): Promise<any> => {
  // course_service scopes lessons under /courses/{courseId}/modules/{moduleId}/lessons —
  // the caller only has moduleId, so the course_id must already be known by the page.
  throw new Error('Use getVideosForModule(courseId, moduleId) — Edura scopes lessons under a course.')
}

export const getVideosForModule = async (courseId: string, moduleId: string) => {
  const response = await apiClient.get(`/api/courses/${courseId}/modules/${moduleId}/lessons`)
  return response.data
}

export const createVideo = async (_data: VideoCreateData): Promise<any> => {
  throw new Error('Use createVideoForModule(courseId, data) — Edura scopes lessons under a course.')
}

export const createVideoForModule = async (courseId: string, data: VideoCreateData) => {
  const response = await apiClient.post(`/api/courses/${courseId}/modules/${data.module_id}/lessons`, {
    title: data.title,
    youtube_video_id: data.yt_video_id,
    duration_seconds: data.duration_seconds,
    order: data.order_number,
  })
  return response.data
}

export const updateVideo = async (_id: string, _data: VideoUpdateData): Promise<any> => {
  throw new Error('Use updateVideoForModule(courseId, moduleId, id, data) — Edura scopes lessons under a course.')
}

export const updateVideoForModule = async (
  courseId: string,
  moduleId: string,
  lessonId: string,
  data: VideoUpdateData
) => {
  const response = await apiClient.put(`/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, {
    title: data.title,
    youtube_video_id: data.yt_video_id,
    duration_seconds: data.duration_seconds,
    order: data.order_number,
  })
  return response.data
}

export const deleteVideo = async (_id: string): Promise<any> => {
  throw new Error('Use deleteVideoForModule(courseId, moduleId, id) — Edura scopes lessons under a course.')
}

export const deleteVideoForModule = async (courseId: string, moduleId: string, lessonId: string) => {
  await apiClient.delete(`/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`)
  return { message: 'Video deleted' }
}

export const getMaterials = async (_moduleId: string) => {
  return []
}

export const createMaterial = async (_data: MaterialCreateData): Promise<any> => {
  throw new Error('Lesson materials are not a separate entity in Edura — see cloudinary_asset_url on a lesson.')
}

export const updateMaterial = async (_id: string, _data: MaterialUpdateData): Promise<any> => {
  throw new Error('Lesson materials are not supported by the Edura backend.')
}

export const deleteMaterial = async (_id: string): Promise<any> => {
  throw new Error('Lesson materials are not supported by the Edura backend.')
}

// In-Video Checkpoints — no such concept exists in Edura.

export const importVideoCheckpointsCSV = async (_videoId: string, _file: File): Promise<any> => {
  throw new Error('Video checkpoints are not supported by the Edura backend.')
}

export const downloadCheckpointCSVTemplate = () => {
  return ''
}

export const getVideoCheckpoints = async (_videoId: string) => {
  return []
}

export const deleteVideoCheckpoint = async (_checkpointId: string): Promise<any> => {
  throw new Error('Video checkpoints are not supported by the Edura backend.')
}

export const clearVideoCheckpoints = async (_videoId: string): Promise<any> => {
  throw new Error('Video checkpoints are not supported by the Edura backend.')
}

export const updateVideoCheckpoint = async (_checkpointId: string, _data: { timestamp_seconds: number }): Promise<any> => {
  throw new Error('Video checkpoints are not supported by the Edura backend.')
}

export const updateCheckpointQuestion = async (_questionId: string, _data: any): Promise<any> => {
  throw new Error('Video checkpoints are not supported by the Edura backend.')
}

// Exam / Course / Sub-Course / Video Module Access Management — enrollment_service
// only answers "is this one student enrolled in this one course"; there is no
// bulk "eligible/enrolled students" listing or grant/revoke endpoint.

export interface EligibleStudent {
  user_id: string
  full_name: string
  grade: number
  district: string
  school: string
}

export interface EnrolledStudent {
  user_id: string
  full_name: string
  enrolled_at: string
  is_manual: boolean
}

export const getEligibleStudentsForExam = async (_examId: string, _search?: string): Promise<EligibleStudent[]> => {
  return []
}

export const getEnrolledStudentsForExam = async (_examId: string): Promise<EnrolledStudent[]> => {
  return []
}

export const grantExamAccess = async (_examId: string, _userIds: string[]): Promise<{ message: string }> => {
  throw new Error('Manually granting exam access is not supported by the Edura backend.')
}

export const revokeExamAccess = async (_examId: string, _userId: string): Promise<{ message: string }> => {
  throw new Error('Manually revoking exam access is not supported by the Edura backend.')
}

export const getEligibleStudentsForCourse = async (_courseId: string, _search?: string): Promise<EligibleStudent[]> => {
  return []
}

export const getEnrolledStudentsForCourse = async (_courseId: string): Promise<EnrolledStudent[]> => {
  return []
}

export const grantCourseAccess = async (_courseId: string, _userIds: string[]): Promise<{ message: string }> => {
  throw new Error('Manually granting course access is not supported by the Edura backend.')
}

export const revokeCourseAccess = async (_courseId: string, _userId: string): Promise<{ message: string }> => {
  throw new Error('Manually revoking course access is not supported by the Edura backend.')
}

export const getEligibleStudentsForSubCourse = async (_subCourseId: string, _search?: string): Promise<EligibleStudent[]> => {
  return []
}

export const getEnrolledStudentsForSubCourse = async (_subCourseId: string): Promise<EnrolledStudent[]> => {
  return []
}

export const grantSubCourseAccess = async (_subCourseId: string, _userIds: string[]): Promise<{ message: string }> => {
  throw new Error('Sub-courses are not supported by the Edura backend.')
}

export const revokeSubCourseAccess = async (_subCourseId: string, _userId: string): Promise<{ message: string }> => {
  throw new Error('Sub-courses are not supported by the Edura backend.')
}

export const getEligibleStudentsForVideoModule = async (_moduleId: string, _search?: string): Promise<EligibleStudent[]> => {
  return []
}

export const getEnrolledStudentsForVideoModule = async (_moduleId: string): Promise<EnrolledStudent[]> => {
  return []
}

export const grantVideoModuleAccess = async (_moduleId: string, _userIds: string[]): Promise<{ message: string }> => {
  throw new Error('Manually granting module access is not supported by the Edura backend.')
}

export const revokeVideoModuleAccess = async (_moduleId: string, _userId: string): Promise<{ message: string }> => {
  throw new Error('Manually revoking module access is not supported by the Edura backend.')
}

// ── Super Admin Management (best-effort real: user_service + auth_service) ──

export interface AdminResponse {
  id: string
  user_id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export interface AdminCreateData {
  email: string
  full_name: string
  password: string
}

export const getSubAdmins = async (): Promise<{ total: number; admins: AdminResponse[] }> => {
  const response = await apiClient.get('/api/users/', { params: { page: 1, page_size: 100 } })
  const admins: AdminResponse[] = response.data.items
    .filter((p: any) => p.role === 'admin')
    .map((p: any) => ({
      id: String(p.id),
      user_id: String(p.id),
      email: p.email ?? '',
      full_name: p.name,
      role: p.role,
      is_active: true,
      created_at: p.created_at,
    }))
  return { total: admins.length, admins }
}

export const createSubAdmin = async (data: AdminCreateData): Promise<AdminResponse> => {
  // Creates the login (auth_service); user_service has no endpoint to create
  // the matching profile, so the account exists but has no name/profile yet.
  const response = await apiClient.post('/api/auth/register', {
    email: data.email,
    password: data.password,
    role: 'admin',
  })
  return {
    id: String(response.data.id),
    user_id: String(response.data.id),
    email: response.data.email,
    full_name: data.full_name,
    role: 'admin',
    is_active: response.data.is_active,
    created_at: new Date().toISOString(),
  }
}

export const deleteSubAdmin = async (adminId: string): Promise<void> => {
  await apiClient.delete(`/api/users/${adminId}`)
}

// ── Video Module Management (aliases onto the real functions above) ─────────

export const getModulesForCourse = async (courseId: string): Promise<any[]> => {
  return getModules(courseId)
}

export const getMaterialsForVideo = async (_videoId: string): Promise<any[]> => {
  return []
}

// ── Class Packages — no such concept exists in Edura. ────────────────────

export interface ClassPackage {
  id: string
  name: string
  description: string | null
  grade: number
  stream_id: string | null
  stream_name: string | null
  price: number
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface ClassPackageCreateData {
  name: string
  description?: string | null
  grade: number
  stream_id?: string | null
  price: number
  is_active?: boolean
}

export interface ClassPackageUpdateData {
  name?: string
  description?: string | null
  grade?: number
  stream_id?: string | null
  price?: number
  is_active?: boolean
}

export interface ClassEnrollment {
  id: string
  user_id: string
  user_email: string | null
  class_package_id: string
  package_name: string | null
  package_grade: number | null
  payment_id: string | null
  status: string
  enrolled_at: string
  expires_at: string | null
}

export const getClassPackages = async (_params?: { grade?: number; stream_id?: string; is_active?: boolean }): Promise<ClassPackage[]> => {
  return []
}

export const createClassPackage = async (_data: ClassPackageCreateData): Promise<ClassPackage> => {
  throw new Error('Class packages are not supported by the Edura backend.')
}

export const updateClassPackage = async (_id: string, _data: ClassPackageUpdateData): Promise<ClassPackage> => {
  throw new Error('Class packages are not supported by the Edura backend.')
}

export const deleteClassPackage = async (_id: string): Promise<void> => {
  throw new Error('Class packages are not supported by the Edura backend.')
}

export const autoGenerateClassPackages = async (): Promise<{ created: string[]; count: number }> => {
  return { created: [], count: 0 }
}

export const getClassEnrollments = async (_params?: { user_id?: string; class_package_id?: string }): Promise<ClassEnrollment[]> => {
  return []
}

export const adminGrantClassEnrollment = async (_data: { user_id: string; class_package_id: string; expires_at?: string }): Promise<any> => {
  throw new Error('Class packages are not supported by the Edura backend.')
}

export const adminRevokeClassEnrollment = async (_enrollmentId: string): Promise<void> => {
  throw new Error('Class packages are not supported by the Edura backend.')
}
