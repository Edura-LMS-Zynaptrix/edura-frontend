/**
 * Admin API Client
 *
 * Course + lesson management lives in course_service, exams and questions in
 * assessment_service, file uploads in content_service, users in user_service,
 * payments in payment_service, and the dashboard figures and analytics are
 * composed by analytics_service.
 * Every export below keeps its original name/signature; those with a real
 * backing endpoint call it (with field translation), the rest return an
 * empty default or reject clearly — never a fabricated network call.
 */
import apiClient from './client';
import { mapAttemptReview } from './student';
import * as paymentApi from './payment';

// ── Types (unchanged from the original ExamBuddy shape) ─────────────────────

export interface AdminActivityItem {
  type: 'student' | 'payment' | 'exam';
  title: string;
  subtitle: string;
  timestamp: string | null;
}

export interface AdminStats {
  total_students: number;
  total_courses: number;
  total_exams: number;
  total_exam_attempts: number;
  total_revenue: number;
  revenue_this_month: number;
  pending_bank_slips: number;
  recent_activity: AdminActivityItem[];
}

export interface SubCourseCreateData {
  course_id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  image_public_id?: string | null;
  order_number: number;
  is_active?: boolean;
}

export interface SubCourseUpdateData {
  title?: string;
  description?: string | null;
  image_url?: string | null;
  image_public_id?: string | null;
  order_number?: number;
  is_active?: boolean;
}

export interface ExamCreateData {
  course_id: string;
  sub_course_id?: string | null;
  title: string;
  image_url?: string | null;
  image_public_id?: string | null;
  description?: string | null;
  duration_minutes: number;
  total_questions: number;
  price: number;
  scheduled_start?: string | null;
  order_number: number;
  is_published: boolean;
}

export interface ExamUpdateData {
  course_id?: string | null;
  sub_course_id?: string | null;
  title?: string;
  image_url?: string | null;
  image_public_id?: string | null;
  description?: string | null;
  duration_minutes?: number;
  total_questions?: number;
  price?: number;
  scheduled_start?: string | null;
  order_number?: number;
  is_published?: boolean;
}

export interface QuestionOptionCreateData {
  option_text?: string | null;
  option_image_url?: string | null;
  option_image_public_id?: string | null;
  is_correct: boolean;
  order_number: number;
}

export interface QuestionCreateData {
  exam_id: string;
  question_text: string;
  question_image_url?: string | null;
  question_image_public_id?: string | null;
  explanation?: string | null;
  video_url?: string | null;
  order_number: number;
  options: QuestionOptionCreateData[];
}

export interface QuestionUpdateData {
  question_text?: string;
  question_image_url?: string | null;
  question_image_public_id?: string | null;
  explanation?: string | null;
  video_url?: string | null;
  order_number?: number;
  options?: any[];
}

export interface ModuleCreateData {
  course_id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  image_public_id?: string | null;
  order_number: number;
  is_active?: boolean;
}

export interface ModuleUpdateData {
  title?: string;
  description?: string | null;
  image_url?: string | null;
  image_public_id?: string | null;
  order_number?: number;
  is_active?: boolean;
}

export interface VideoCreateData {
  module_id: string;
  title: string;
  description?: string | null;
  yt_video_id: string;
  duration_seconds: number;
  order_number: number;
  is_published: boolean;
}

export interface VideoUpdateData {
  title?: string;
  description?: string | null;
  yt_video_id?: string;
  duration_seconds?: number;
  order_number?: number;
  is_published?: boolean;
}

export interface MaterialCreateData {
  module_id: string;
  video_id?: string | null;
  title: string;
  file_url: string;
  file_type: string;
  file_public_id?: string | null;
  order_number: number;
}

export interface MaterialUpdateData {
  video_id?: string | null;
  title?: string;
  file_url?: string;
  file_type?: string;
  file_public_id?: string | null;
  order_number?: number;
}

// ── Stats (derived client-side from real per-service endpoints — there's no
// single cross-service aggregate endpoint, so this composes user_service's
// /stats, course_service's list count, and payment_service's receipts/payments) ─

export const getAdminStats = async (): Promise<AdminStats> => {
  const response = await apiClient.get('/api/analytics/admin/stats');
  return response.data;
};

// Students Management (real: user_service)

export interface AdminStudent {
  user_id: string;
  email: string;
  is_active: boolean;
  needs_profile_completion: boolean;
  joined_at: string | null;
  full_name: string;
  phone_number: string;
  parent_phone_number: string | null;
  school: string;
  district: string;
  grade: number;
  nic_number: string | null;
  profile_photo_url: string | null;
  enrollment_count: number;
  attempt_count: number;
  referral_code: string | null;
  referred_by_code: string | null;
  wallet_credits: number;
  successful_referrals: number;
  total_referral_credits: number;
}

export interface AdminStudentsResponse {
  total: number;
  students: AdminStudent[];
}

function mapProfileToAdminStudent(p: any): AdminStudent {
  return {
    user_id: String(p.id),
    email: p.email ?? '',
    is_active: p.is_active ?? true,
    needs_profile_completion: false,
    joined_at: p.created_at,
    full_name: p.name,
    phone_number: p.mobile_no ?? '',
    parent_phone_number: null,
    school: p.school ?? '',
    district: p.district ?? '',
    grade: p.grade ?? 0,
    nic_number: p.nic_number ?? null,
    profile_photo_url: p.avatar_url ?? null,
    enrollment_count: 0,
    attempt_count: 0,
    referral_code: p.referral_code ?? null,
    referred_by_code: null,
    wallet_credits: 0,
    successful_referrals: 0,
    total_referral_credits: 0,
  };
}

export const getAdminStudents = async (params?: {
  search?: string;
  grade?: number;
  district?: string;
  is_active?: boolean;
  skip?: number;
  limit?: number;
}): Promise<AdminStudentsResponse> => {
  const page = params?.skip
    ? Math.floor(params.skip / (params.limit ?? 20)) + 1
    : 1;
  const response = await apiClient.get('/api/users/', {
    params: {
      page,
      page_size: params?.limit ?? 20,
      role: 'student',
      search: params?.search,
    },
  });
  let students: AdminStudent[] = response.data.items.map(
    mapProfileToAdminStudent
  );
  if (params?.district) {
    const q = params.district.toLowerCase();
    students = students.filter((s) => s.district.toLowerCase().includes(q));
  }
  if (params?.grade) {
    students = students.filter((s) => s.grade === params.grade);
  }
  if (params?.is_active !== undefined) {
    students = students.filter((s) => s.is_active === params.is_active);
  }
  return { total: response.data.total, students };
};

export const toggleStudentActive = async (
  userId: string
): Promise<{ user_id: string; is_active: boolean }> => {
  // Caller doesn't know the current state up front, so flip it: read, then write the opposite.
  const current = await apiClient.get(`/api/users/${userId}`);
  const nextActive = !(current.data.is_active ?? true);
  const response = await apiClient.put(`/api/auth/users/${userId}/status`, {
    is_active: nextActive,
  });
  return response.data;
};

// Deletes the account everywhere — the profile (user_service) and the login
// record (auth_service). Deleting only the profile would leave a login-only
// account behind that could still authenticate but shows up nowhere.
export const deleteStudent = async (
  userId: string
): Promise<{ message: string }> => {
  await apiClient.delete(`/api/users/${userId}`);
  await apiClient.delete(`/api/auth/users/${userId}`).catch(() => {});
  return { message: 'Student deleted' };
};

// Student Progress Analytics

export interface ExamAttemptDetail {
  id: string;
  attempt_number: number;
  score_pct: number;
  marks_obtained: number;
  total_questions: number;
  time_seconds: number;
  submitted_at: string | null;
  status: 'passed' | 'failed';
}

export interface StudentProgressData {
  student: {
    full_name: string;
    grade: number;
    school: string;
    district: string;
    badges_count: number;
    phone_number: string;
    parent_phone_number: string | null;
  };
  overall: {
    total_unique_exams: number;
    unique_exams_attempted: number;
    total_attempts_made: number;
    completion_pct: number;
    avg_score_pct: number;
    avg_time_seconds: number;
  };
  subjects: {
    subject: string;
    course_title: string;
    total_exams: number;
    attempted_exams: number;
    total_attempts_count: number;
    avg_score_pct: number;
    best_score_pct: number;
    avg_time_seconds: number;
    score_trend: number[];
    time_trend: number[];
    exams: {
      id: string;
      title: string;
      order_number: number;
      best_score_pct: number;
      attempts_count: number;
      latest_score_pct: number;
      history: ExamAttemptDetail[];
    }[];
  }[];
}

export interface StudentProgressSummary {
  user_id: string;
  full_name: string;
  completion_pct: number;
  avg_score_pct: number;
}

// Composed by analytics_service from enrollment, assessment, course and user data.
export const getStudentProgress = async (
  userId: string
): Promise<StudentProgressData> => {
  const response = await apiClient.get(
    `/api/analytics/students/${userId}/progress`
  );
  return response.data;
};

export const getAllStudentsProgressSummary = async (): Promise<
  StudentProgressSummary[]
> => {
  const response = await apiClient.get(
    '/api/analytics/students/progress-summary'
  );
  return response.data;
};

// The PDF is built by analytics_service and emailed by notification_service.
export const sendStudentReportDetail = async (
  userId: string
): Promise<{ message: string }> => {
  const response = await apiClient.post(
    `/api/analytics/students/${userId}/send-report`
  );
  return response.data;
};

// The attempt id identifies the student already; userId is kept for the page's URL shape.
export const fetchStudentAttemptReview = async (
  _userId: string,
  attemptId: string
): Promise<any> => {
  const response = await apiClient.get(
    `/api/assessments/submissions/${attemptId}/review`
  );
  return mapAttemptReview(response.data);
};

// Analytics

export interface AnalyticsData {
  revenue_by_month: {
    year: number;
    month: number;
    revenue: number;
    count: number;
  }[];
  students_by_grade: { grade: number; count: number }[];
  students_by_district: { district: string; count: number }[];
  attempts_by_month: { year: number; month: number; count: number }[];
  top_exams: {
    exam_id: string;
    title: string;
    subject: string;
    grade: number | null;
    attempt_count: number;
    avg_score: number;
  }[];
  enrollments_by_subject: { subject: string; count: number }[];
}

export interface StrugglePerformanceItem {
  id: string;
  title: string;
  type: 'exam' | 'lesson';
  avg_score: number;
  failure_rate: number;
  total_students: number;
  attempt_count: number;
}

export interface CourseStruggleResponse {
  course_id: string;
  overall_avg_score: number;
  overall_failure_rate: number;
  struggling_modules: StrugglePerformanceItem[];
  hardest_exams: StrugglePerformanceItem[];
}

// Composed by analytics_service from payment, assessment, user, enrollment and course data.
export const getAdminAnalytics = async (): Promise<AnalyticsData> => {
  const response = await apiClient.get('/api/analytics/admin/analytics');
  return response.data;
};

// First attempts only, so retakes don't hide where students struggle.
export const getCourseStruggleAnalysis = async (
  courseId: string
): Promise<CourseStruggleResponse> => {
  const response = await apiClient.get(
    `/api/analytics/courses/${courseId}/struggle`
  );
  return response.data;
};

// Rankings (real, when an exam_id is given — resolved via progress_service)

export interface AdminRankingRow {
  island_rank: number;
  district_rank: number;
  user_id: string;
  full_name: string;
  district: string;
  grade: number;
  school: string;
  subject: string;
  total_marks: number;
  total_questions: number;
  score_pct: number;
  time_taken_seconds: number;
  attempt_count: number;
}

export interface AdminExamFilter {
  exam_id: string;
  exam_title: string;
  course_title: string;
  subject: string;
}

export interface AdminRankingsResponse {
  rankings: AdminRankingRow[];
  exams: AdminExamFilter[];
}

export const getAdminRankings = async (params?: {
  exam_id?: string;
  district?: string;
  limit?: number;
}): Promise<AdminRankingsResponse> => {
  if (!params?.exam_id) {
    // No endpoint enumerates assessments across courses, so there's nothing
    // to list until a specific exam is chosen.
    return { rankings: [], exams: [] };
  }
  const assessmentRes = await apiClient.get(
    `/api/assessments/${params.exam_id}`
  );
  const courseId = assessmentRes.data.course_id;
  const leaderboardRes = await apiClient.get(
    `/api/progress/courses/${courseId}/leaderboard`
  );
  const rankings: AdminRankingRow[] = leaderboardRes.data
    .slice(0, params.limit ?? 50)
    .map((row: any) => ({
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
    }));
  return {
    rankings,
    exams: [
      {
        exam_id: params.exam_id,
        exam_title: assessmentRes.data.title,
        course_title: '',
        subject: '',
      },
    ],
  };
};

// Stream Management (real: user_service)

export interface AdminStream {
  id: string;
  name: string;
  subjects: string[];
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface StreamCreateData {
  name: string;
  subjects: string[];
  description?: string;
}

export interface StreamUpdateData {
  name?: string;
  subjects?: string[];
  description?: string;
  is_active?: boolean;
}

function mapAdminStream(s: any): AdminStream {
  return {
    id: String(s.id),
    name: s.name,
    subjects: s.subjects,
    description: s.description ?? null,
    is_active: s.is_active,
    created_at: s.created_at,
    updated_at: null,
  };
}

export const getStreams = async (): Promise<AdminStream[]> => {
  const response = await apiClient.get('/api/users/streams', {
    params: { active_only: false },
  });
  return response.data.map(mapAdminStream);
};

export const getStream = async (id: string): Promise<AdminStream> => {
  const all = await getStreams();
  const found = all.find((s) => s.id === id);
  if (!found) throw new Error('Stream not found');
  return found;
};

export const createStream = async (
  data: StreamCreateData
): Promise<AdminStream> => {
  const response = await apiClient.post('/api/users/streams', data);
  return mapAdminStream(response.data);
};

export const updateStream = async (
  id: string,
  data: StreamUpdateData
): Promise<AdminStream> => {
  const response = await apiClient.put(`/api/users/streams/${id}`, data);
  return mapAdminStream(response.data);
};

export const deleteStream = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/users/streams/${id}`);
};

// Grade Subject Management (real: user_service)

export interface GradeSubject {
  id: string;
  name: string;
  grade: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

function mapGradeSubject(s: any): GradeSubject {
  return {
    id: String(s.id),
    name: s.name,
    grade: s.grade,
    is_active: s.is_active,
    created_at: s.created_at,
    updated_at: null,
  };
}

export const getGradeSubjects = async (
  grade?: number
): Promise<GradeSubject[]> => {
  const response = await apiClient.get('/api/users/grade-subjects', {
    params: { grade, active_only: false },
  });
  return response.data.map(mapGradeSubject);
};

export const createGradeSubject = async (data: {
  name: string;
  grade: number;
  is_active?: boolean;
}): Promise<GradeSubject> => {
  const response = await apiClient.post('/api/users/grade-subjects', data);
  return mapGradeSubject(response.data);
};

export const updateGradeSubject = async (
  id: string,
  data: { name?: string; is_active?: boolean }
): Promise<GradeSubject> => {
  const response = await apiClient.put(`/api/users/grade-subjects/${id}`, data);
  return mapGradeSubject(response.data);
};

export const deleteGradeSubject = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/users/grade-subjects/${id}`);
};

// Course Management (real: course_service)

// A course_service module is the "lesson" level of both course types: video
// courses put videos + materials inside it, exam courses put exams inside it.
function mapAdminModule(m: any): any {
  return {
    id: String(m.id),
    course_id: String(m.course_id),
    title: m.title,
    description: m.description ?? null,
    image_url: m.image_url ?? null,
    image_public_id: m.image_public_id ?? null,
    order_number: m.order ?? 0,
    is_active: m.is_active ?? true,
    video_count: m.lesson_count ?? 0,
    created_at: m.created_at,
  };
}

function mapAdminCourse(c: any): any {
  return {
    id: String(c.id),
    title: c.title,
    subject: '',
    grade: c.grade ?? 0,
    course_type: c.course_type ?? 'video',
    image_url: c.thumbnail_url ?? null,
    image_public_id: c.thumbnail_public_id ?? null,
    price: Number(c.price ?? 0),
    description: c.description ?? null,
    is_active: c.status === 'PUBLISHED',
    status: c.status,
    stream_ids: (c.stream_ids ?? []).map(String),
    sub_courses: (c.modules ?? []).map(mapAdminModule),
  };
}

export const getCourses = async () => {
  const pageSize = 100;
  const items: any[] = [];
  for (let page = 1; ; page++) {
    const response = await apiClient.get('/api/courses/', {
      params: { include_modules: true, page, page_size: pageSize },
    });
    items.push(...response.data.items);
    if (
      items.length >= response.data.total ||
      response.data.items.length < pageSize
    )
      break;
  }
  return items.map(mapAdminCourse);
};

export const createCourse = async (data: {
  title: string;
  subject: string;
  grade: number;
  course_type: 'exam' | 'video';
  price: number;
  description?: string | null;
  image_url?: string | null;
  image_public_id?: string | null;
  stream_ids?: string[];
}) => {
  const response = await apiClient.post('/api/courses/', {
    title: data.title,
    description: data.description,
    price: data.price,
    course_type: data.course_type,
    grade: data.grade || undefined,
    stream_ids: data.stream_ids?.length
      ? data.stream_ids.map(Number)
      : undefined,
    thumbnail_url: data.image_url,
    thumbnail_public_id: data.image_public_id,
  });
  return mapAdminCourse(response.data);
};

export const updateCourse = async (
  id: string,
  data: {
    title?: string;
    subject?: string;
    grade?: number;
    course_type?: 'exam' | 'video';
    price?: number;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    description?: string | null;
    image_url?: string | null;
    image_public_id?: string | null;
    stream_ids?: string[];
  }
) => {
  const response = await apiClient.put(`/api/courses/${id}`, {
    title: data.title,
    description: data.description,
    price: data.price,
    course_type: data.course_type,
    grade: data.grade || undefined,
    stream_ids: data.stream_ids ? data.stream_ids.map(Number) : undefined,
    status: data.status,
    thumbnail_url: data.image_url,
    thumbnail_public_id: data.image_public_id,
  });
  return mapAdminCourse(response.data);
};

export const deleteCourse = async (id: string) => {
  await apiClient.delete(`/api/courses/${id}`);
  return { message: 'Course deleted' };
};

// Exam-course lessons ("sub-courses" in the ported pages) are the same
// course_service modules that video courses use.
export const getSubCourses = async (courseId: string) => {
  return getModules(courseId);
};

export const createSubCourse = async (
  data: SubCourseCreateData
): Promise<any> => {
  return createModule(data);
};

export const updateSubCourse = async (
  courseId: string,
  id: string,
  data: SubCourseUpdateData
): Promise<any> => {
  return updateModuleForCourse(courseId, id, data);
};

export const deleteSubCourse = async (
  courseId: string,
  id: string
): Promise<any> => {
  // Exams live in assessment_service, so clear them before the lesson itself.
  await apiClient.delete(`/api/assessments/by-module/${id}`, {
    params: { course_id: courseId },
  });
  return deleteModuleForCourse(courseId, id);
};

// Exam Management (real: assessment_service)

function mapAdminExam(a: any): any {
  return {
    id: String(a.id),
    course_id: String(a.course_id),
    sub_course_id: a.module_id != null ? String(a.module_id) : null,
    title: a.title,
    image_url: a.image_url ?? null,
    image_public_id: a.image_public_id ?? null,
    description: a.description ?? null,
    duration_minutes: a.time_limit_minutes ?? 0,
    total_questions: a.question_count ?? 0,
    price: 0, // exams aren't priced separately from their course in Edura
    order_number: a.position ?? 0,
    scheduled_start: a.scheduled_start ?? null,
    is_published: a.is_published,
  };
}

// datetime-local inputs give local wall-clock time without a zone.
const toIsoOrNull = (value?: string | null) =>
  value ? new Date(value).toISOString() : null;

export const getExams = async (courseId?: string) => {
  if (!courseId) return [];
  const response = await apiClient.get('/api/assessments/', {
    params: { course_id: courseId },
  });
  return response.data.map(mapAdminExam);
};

export const createExam = async (data: ExamCreateData): Promise<any> => {
  const response = await apiClient.post('/api/assessments/', {
    course_id: Number(data.course_id),
    module_id: data.sub_course_id ? Number(data.sub_course_id) : null,
    title: data.title,
    description: data.description,
    assessment_type: 'exam',
    time_limit_minutes: data.duration_minutes,
    image_url: data.image_url ?? null,
    image_public_id: data.image_public_id ?? null,
    position: data.order_number ?? 0,
    scheduled_start: toIsoOrNull(data.scheduled_start),
    // Lesson is_active + scheduled_start gate student visibility, as in ExamBuddy.
    is_published: data.is_published ?? true,
  });
  return mapAdminExam(response.data);
};

export const updateExam = async (
  id: string,
  data: ExamUpdateData
): Promise<any> => {
  const body: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    time_limit_minutes: data.duration_minutes,
    is_published: data.is_published,
    position: data.order_number,
  };
  if (data.sub_course_id !== undefined)
    body.module_id = data.sub_course_id ? Number(data.sub_course_id) : null;
  if (data.image_url !== undefined) body.image_url = data.image_url;
  if (data.image_public_id !== undefined)
    body.image_public_id = data.image_public_id;
  if (data.scheduled_start !== undefined)
    body.scheduled_start = toIsoOrNull(data.scheduled_start);
  const response = await apiClient.put(`/api/assessments/${id}`, body);
  return mapAdminExam(response.data);
};

export interface ZipUploadResult {
  applied: number;
  skipped: number;
  errors: string[];
  message: string;
}

// Images named {question_number}-{n}.png: n = 0 question image, 1-5 options A-E.
export const uploadQuestionImagesZip = async (
  examId: string,
  file: File
): Promise<ZipUploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(
    `/api/assessments/${examId}/questions/images-zip`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return response.data;
};

export const deleteExam = async (id: string): Promise<any> => {
  await apiClient.delete(`/api/assessments/${id}`);
  return { message: 'Exam deleted' };
};

// Image / File Management (real: content_service, teacher/admin only)

export const uploadImage = async (file: File, _entity: string) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/api/content/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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
  };
};

export const deleteImage = async (publicId: string): Promise<any> => {
  await apiClient.delete('/api/content/assets', {
    params: { public_id: publicId },
  });
  return { message: 'Asset deleted' };
};

// Downloadable materials (pdf/doc/docx/zip/images) — stored as Cloudinary raw files.
export const uploadFile = async (file: File, _entity: string = 'materials') => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(
    '/api/content/upload-material',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return {
    file_url: response.data.secure_url as string,
    file_public_id: response.data.public_id as string,
    file_type: response.data.mime_type as string,
  };
};

// Question Management (real: assessment_service)

function mapAdminQuestion(q: any): any {
  const options = (q.options as string[]) ?? [];
  const images =
    (q.option_images as ({ url: string; public_id: string | null } | null)[]) ??
    [];
  return {
    id: String(q.id),
    exam_id: String(q.assessment_id),
    question_text: q.question_text,
    question_image_url: q.question_image_url ?? null,
    question_image_public_id: q.question_image_public_id ?? null,
    explanation: q.explanation ?? null,
    video_url: null,
    order_number: q.position,
    options: options.map((text: string, idx: number) => ({
      id: `${q.id}-${idx}`,
      option_text: text,
      option_image_url: images[idx]?.url ?? null,
      option_image_public_id: images[idx]?.public_id ?? null,
      is_correct: text === q.correct_answer,
      order_number: idx,
    })),
  };
}

const toOptionInput = (o: any) => ({
  option_text: o.option_text ?? '',
  is_correct: o.is_correct,
  option_image_url: o.option_image_url ?? null,
  option_image_public_id: o.option_image_public_id ?? null,
});

export const getQuestions = async (examId: string) => {
  const response = await apiClient.get(`/api/assessments/${examId}/questions`);
  return response.data.map(mapAdminQuestion);
};

export const getQuestion = async (_id: string): Promise<any> => {
  throw new Error(
    'Fetching a single question by id is not supported — list questions for its exam instead.'
  );
};

export const createQuestion = async (
  data: QuestionCreateData
): Promise<any> => {
  const response = await apiClient.post(
    `/api/assessments/${data.exam_id}/questions`,
    {
      question_text: data.question_text,
      question_type: 'mcq',
      options: data.options.map(toOptionInput),
      explanation: data.explanation ?? null,
      question_image_url: data.question_image_url ?? null,
      question_image_public_id: data.question_image_public_id ?? null,
      marks: 1,
      position: data.order_number,
    }
  );
  return mapAdminQuestion(response.data);
};

export const updateQuestion = async (
  id: string,
  data: QuestionUpdateData
): Promise<any> => {
  const response = await apiClient.put(`/api/assessments/questions/${id}`, {
    question_text: data.question_text,
    options: data.options?.map(toOptionInput),
    explanation: data.explanation,
    question_image_url: data.question_image_url,
    question_image_public_id: data.question_image_public_id,
    position: data.order_number,
  });
  return mapAdminQuestion(response.data);
};

export const deleteQuestion = async (id: string): Promise<any> => {
  await apiClient.delete(`/api/assessments/questions/${id}`);
  return { message: 'Question deleted' };
};

export const importQuestionsCSV = async (
  examId: string,
  file: File
): Promise<{
  message: string;
  questions_created: number;
  errors: string[];
}> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(
    `/api/assessments/${examId}/questions/import-csv`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return response.data;
};

// A plain <a href> can't carry the bearer token, so fetch it as a blob and
// hand the browser an object URL to save.
export const downloadQuestionsCSVTemplate = async (): Promise<void> => {
  const response = await apiClient.get(
    '/api/assessments/questions/csv-template',
    {
      responseType: 'blob',
    }
  );
  const url = URL.createObjectURL(
    new Blob([response.data], { type: 'text/csv' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'questions_template.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// Bulk exam import (assessment_service): exams.csv + questions/<folder>/ bundle.

export interface BulkImportExamDetail {
  folder: string;
  title: string;
  exam_id: string;
  questions_created: number;
  images_applied: number;
  warnings: string[] | null;
}

export interface BulkImportResult {
  created_exams: number;
  total_questions_created: number;
  skipped_exams: number;
  details: BulkImportExamDetail[];
  errors: { exam: string; message: string }[];
}

export const bulkImportExams = async (
  courseId: string,
  subCourseId: string,
  file: File
): Promise<BulkImportResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(
    '/api/assessments/bulk-import',
    formData,
    {
      params: {
        course_id: Number(courseId),
        module_id: subCourseId ? Number(subCourseId) : undefined,
      },
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return response.data;
};

export const downloadBulkImportTemplate = async (): Promise<void> => {
  const response = await apiClient.get(
    '/api/assessments/bulk-import/template',
    { responseType: 'blob' }
  );
  const url = URL.createObjectURL(
    new Blob([response.data], { type: 'application/zip' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bulk_exam_template.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// Video Classes Management (real: course_service modules + lessons)

export const getModules = async (courseId: string) => {
  const response = await apiClient.get(`/api/courses/${courseId}/modules`);
  return response.data.map(mapAdminModule);
};

export const getModule = async (_moduleId: string): Promise<any> => {
  throw new Error(
    'Fetching a single module by id is not supported — list modules for its course instead.'
  );
};

export const createModule = async (data: ModuleCreateData) => {
  const response = await apiClient.post(
    `/api/courses/${data.course_id}/modules`,
    {
      title: data.title,
      description: data.description ?? null,
      image_url: data.image_url ?? null,
      image_public_id: data.image_public_id ?? null,
      is_active: data.is_active ?? true,
      order: data.order_number,
    }
  );
  return mapAdminModule(response.data);
};

export const updateModule = async (
  _id: string,
  _data: ModuleUpdateData
): Promise<any> => {
  throw new Error(
    'Use updateModuleForCourse(courseId, id, data) — Edura scopes modules under a course.'
  );
};

export const updateModuleForCourse = async (
  courseId: string,
  moduleId: string,
  data: ModuleUpdateData
) => {
  const response = await apiClient.put(
    `/api/courses/${courseId}/modules/${moduleId}`,
    {
      title: data.title,
      description: data.description,
      image_url: data.image_url,
      image_public_id: data.image_public_id,
      is_active: data.is_active,
      order: data.order_number,
    }
  );
  return mapAdminModule(response.data);
};

export const deleteModuleForCourse = async (
  courseId: string,
  moduleId: string
) => {
  await apiClient.delete(`/api/courses/${courseId}/modules/${moduleId}`);
  return { message: 'Module deleted' };
};

export const getVideos = async (_moduleId: string): Promise<any> => {
  // course_service scopes lessons under /courses/{courseId}/modules/{moduleId}/lessons —
  // the caller only has moduleId, so the course_id must already be known by the page.
  throw new Error(
    'Use getVideosForModule(courseId, moduleId) — Edura scopes lessons under a course.'
  );
};

// course_service's LessonResponse uses its own field names (youtube_video_id,
// order) — translate to the yt_video_id/order_number shape the admin pages
// (and student.ts's VideoLesson) expect.
function mapAdminLesson(l: any): any {
  return {
    id: String(l.id),
    module_id: String(l.module_id),
    title: l.title,
    description: l.description ?? null,
    yt_video_id: l.youtube_video_id ?? '',
    duration_seconds: l.duration_seconds ?? 0,
    order_number: l.order ?? 0,
    is_published: true, // course_service has no per-lesson publish flag
  };
}

export const getVideosForModule = async (
  courseId: string,
  moduleId: string
) => {
  const response = await apiClient.get(
    `/api/courses/${courseId}/modules/${moduleId}/lessons`
  );
  return response.data.map(mapAdminLesson);
};

export const createVideo = async (_data: VideoCreateData): Promise<any> => {
  throw new Error(
    'Use createVideoForModule(courseId, data) — Edura scopes lessons under a course.'
  );
};

export const createVideoForModule = async (
  courseId: string,
  data: VideoCreateData
) => {
  const response = await apiClient.post(
    `/api/courses/${courseId}/modules/${data.module_id}/lessons`,
    {
      title: data.title,
      description: data.description ?? null,
      youtube_video_id: data.yt_video_id,
      duration_seconds: data.duration_seconds,
      order: data.order_number,
    }
  );
  return mapAdminLesson(response.data);
};

export const updateVideo = async (
  _id: string,
  _data: VideoUpdateData
): Promise<any> => {
  throw new Error(
    'Use updateVideoForModule(courseId, moduleId, id, data) — Edura scopes lessons under a course.'
  );
};

export const updateVideoForModule = async (
  courseId: string,
  moduleId: string,
  lessonId: string,
  data: VideoUpdateData
) => {
  const response = await apiClient.put(
    `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
    {
      title: data.title,
      description: data.description,
      youtube_video_id: data.yt_video_id,
      duration_seconds: data.duration_seconds,
      order: data.order_number,
    }
  );
  return mapAdminLesson(response.data);
};

export const deleteVideo = async (_id: string): Promise<any> => {
  throw new Error(
    'Use deleteVideoForModule(courseId, moduleId, id) — Edura scopes lessons under a course.'
  );
};

export const deleteVideoForModule = async (
  courseId: string,
  moduleId: string,
  lessonId: string
) => {
  await apiClient.delete(
    `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`
  );
  return { message: 'Video deleted' };
};

// Course materials (real: course_service, scoped course → module → optional video)

function mapAdminMaterial(m: any): any {
  return {
    id: String(m.id),
    module_id: String(m.module_id),
    video_id: m.lesson_id != null ? String(m.lesson_id) : null,
    title: m.title,
    file_url: m.file_url,
    file_type: m.file_type,
    file_public_id: m.file_public_id ?? null,
    order_number: m.order ?? 0,
    created_at: m.created_at,
  };
}

export const getMaterials = async (courseId: string, moduleId: string) => {
  const response = await apiClient.get(
    `/api/courses/${courseId}/modules/${moduleId}/materials`
  );
  return response.data.map(mapAdminMaterial);
};

export const createMaterial = async (
  courseId: string,
  data: MaterialCreateData
): Promise<any> => {
  const response = await apiClient.post(
    `/api/courses/${courseId}/modules/${data.module_id}/materials`,
    {
      lesson_id: data.video_id ? Number(data.video_id) : null,
      title: data.title,
      file_url: data.file_url,
      file_type: data.file_type,
      file_public_id: data.file_public_id ?? null,
      order: data.order_number,
    }
  );
  return mapAdminMaterial(response.data);
};

export const updateMaterial = async (
  courseId: string,
  moduleId: string,
  id: string,
  data: MaterialUpdateData
): Promise<any> => {
  const body: Record<string, unknown> = {
    title: data.title,
    file_url: data.file_url,
    file_type: data.file_type,
    file_public_id: data.file_public_id,
    order: data.order_number,
  };
  if (data.video_id !== undefined)
    body.lesson_id = data.video_id ? Number(data.video_id) : null;
  const response = await apiClient.put(
    `/api/courses/${courseId}/modules/${moduleId}/materials/${id}`,
    body
  );
  return mapAdminMaterial(response.data);
};

export const deleteMaterial = async (
  courseId: string,
  moduleId: string,
  id: string
): Promise<any> => {
  await apiClient.delete(
    `/api/courses/${courseId}/modules/${moduleId}/materials/${id}`
  );
  return { message: 'Material deleted' };
};

// In-Video Checkpoints — no such concept exists in Edura.

// In-video quiz checkpoints (course_service), scoped course -> lesson -> video.
const checkpointsPath = (courseId: string, moduleId: string, videoId: string) =>
  `/api/courses/${courseId}/modules/${moduleId}/lessons/${videoId}/checkpoints`;

export const importVideoCheckpointsCSV = async (
  courseId: string,
  moduleId: string,
  videoId: string,
  file: File
): Promise<{
  message: string;
  questions_created: number;
  errors: string[];
}> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(
    `${checkpointsPath(courseId, moduleId, videoId)}/import-csv`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return response.data;
};

// The template needs the admin's token, so it is fetched and saved as a blob.
export const downloadCheckpointCSVTemplate = async (): Promise<void> => {
  const response = await apiClient.get(
    '/api/courses/checkpoints/csv-template',
    { responseType: 'blob' }
  );
  const url = URL.createObjectURL(
    new Blob([response.data], { type: 'text/csv' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'video_checkpoints_template.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const getVideoCheckpoints = async (
  courseId: string,
  moduleId: string,
  videoId: string
) => {
  const response = await apiClient.get(
    checkpointsPath(courseId, moduleId, videoId)
  );
  return response.data;
};

export const deleteVideoCheckpoint = async (
  checkpointId: string
): Promise<any> => {
  await apiClient.delete(`/api/courses/checkpoints/${checkpointId}`);
  return { message: 'Checkpoint deleted' };
};

export const clearVideoCheckpoints = async (
  courseId: string,
  moduleId: string,
  videoId: string
): Promise<any> => {
  await apiClient.delete(checkpointsPath(courseId, moduleId, videoId));
  return { message: 'Checkpoints cleared' };
};

export const updateVideoCheckpoint = async (
  checkpointId: string,
  data: { timestamp_seconds: number }
): Promise<any> => {
  const response = await apiClient.patch(
    `/api/courses/checkpoints/${checkpointId}`,
    data
  );
  return response.data;
};

export const updateCheckpointQuestion = async (
  questionId: string,
  data: any
): Promise<any> => {
  const response = await apiClient.patch(
    `/api/courses/checkpoint-questions/${questionId}`,
    data
  );
  return response.data;
};

// Exam / Course / Sub-Course / Video Module Access Management — enrollment_service
// only answers "is this one student enrolled in this one course"; there is no
// bulk "eligible/enrolled students" listing or grant/revoke endpoint.

export interface EligibleStudent {
  user_id: string;
  full_name: string;
  grade: number;
  district: string;
  school: string;
}

export interface EnrolledStudent {
  user_id: string;
  full_name: string;
  enrolled_at: string;
  is_manual: boolean;
}

export const getEligibleStudentsForExam = async (
  _examId: string,
  _search?: string
): Promise<EligibleStudent[]> => {
  return [];
};

export const getEnrolledStudentsForExam = async (
  _examId: string
): Promise<EnrolledStudent[]> => {
  return [];
};

export const grantExamAccess = async (
  _examId: string,
  _userIds: string[]
): Promise<{ message: string }> => {
  throw new Error(
    'Manually granting exam access is not supported by the Edura backend.'
  );
};

export const revokeExamAccess = async (
  _examId: string,
  _userId: string
): Promise<{ message: string }> => {
  throw new Error(
    'Manually revoking exam access is not supported by the Edura backend.'
  );
};

// Course- and lesson-level access live in enrollment_service. A lesson is a
// course_service module — the same id whether it holds exams or videos.
const accessParams = (courseId: string, moduleId?: string) =>
  moduleId
    ? { course_id: Number(courseId), module_id: Number(moduleId) }
    : { course_id: Number(courseId) };

const getEligible = async (
  courseId: string,
  moduleId?: string,
  search?: string
): Promise<EligibleStudent[]> => {
  const response = await apiClient.get('/api/enrollments/admin/eligible', {
    params: {
      ...accessParams(courseId, moduleId),
      search: search || undefined,
    },
  });
  return response.data;
};

const getEnrolled = async (
  courseId: string,
  moduleId?: string
): Promise<EnrolledStudent[]> => {
  const response = await apiClient.get('/api/enrollments/admin/enrolled', {
    params: accessParams(courseId, moduleId),
  });
  return response.data;
};

const grantAccess = async (
  courseId: string,
  moduleId: string | undefined,
  userIds: string[]
) => {
  const response = await apiClient.post('/api/enrollments/admin/grant', {
    ...accessParams(courseId, moduleId),
    user_ids: userIds.map(Number),
  });
  return { message: response.data.message as string };
};

const revokeAccess = async (
  courseId: string,
  moduleId: string | undefined,
  userId: string
) => {
  const response = await apiClient.delete('/api/enrollments/admin/revoke', {
    params: { ...accessParams(courseId, moduleId), user_id: Number(userId) },
  });
  return { message: response.data.message as string };
};

export const getEligibleStudentsForCourse = (
  courseId: string,
  search?: string
) => getEligible(courseId, undefined, search);
export const getEnrolledStudentsForCourse = (courseId: string) =>
  getEnrolled(courseId);
export const grantCourseAccess = (courseId: string, userIds: string[]) =>
  grantAccess(courseId, undefined, userIds);
export const revokeCourseAccess = (courseId: string, userId: string) =>
  revokeAccess(courseId, undefined, userId);

export const getEligibleStudentsForSubCourse = (
  courseId: string,
  subCourseId: string,
  search?: string
) => getEligible(courseId, subCourseId, search);
export const getEnrolledStudentsForSubCourse = (
  courseId: string,
  subCourseId: string
) => getEnrolled(courseId, subCourseId);
export const grantSubCourseAccess = (
  courseId: string,
  subCourseId: string,
  userIds: string[]
) => grantAccess(courseId, subCourseId, userIds);
export const revokeSubCourseAccess = (
  courseId: string,
  subCourseId: string,
  userId: string
) => revokeAccess(courseId, subCourseId, userId);

export const getEligibleStudentsForVideoModule = (
  courseId: string,
  moduleId: string,
  search?: string
) => getEligible(courseId, moduleId, search);
export const getEnrolledStudentsForVideoModule = (
  courseId: string,
  moduleId: string
) => getEnrolled(courseId, moduleId);
export const grantVideoModuleAccess = (
  courseId: string,
  moduleId: string,
  userIds: string[]
) => grantAccess(courseId, moduleId, userIds);
export const revokeVideoModuleAccess = (
  courseId: string,
  moduleId: string,
  userId: string
) => revokeAccess(courseId, moduleId, userId);

// ── Admin Management (real: auth_service + user_service) ────────────────────
// Edura's role model has no separate super_admin tier — every admin account
// is equally privileged, and any admin can manage any other admin account.

export interface AdminResponse {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminCreateData {
  email: string;
  full_name: string;
  password: string;
}

export const getSubAdmins = async (): Promise<{
  total: number;
  admins: AdminResponse[];
}> => {
  const response = await apiClient.get('/api/users/', {
    params: { page: 1, page_size: 100, role: 'admin' },
  });
  const admins: AdminResponse[] = response.data.items.map((p: any) => ({
    id: String(p.id),
    user_id: String(p.id),
    email: p.email ?? '',
    full_name: p.name,
    role: p.role,
    is_active: p.is_active ?? true,
    created_at: p.created_at,
  }));
  return { total: response.data.total, admins };
};

export const createSubAdmin = async (
  data: AdminCreateData
): Promise<AdminResponse> => {
  const [first_name, ...rest] = data.full_name.trim().split(' ');
  const last_name = rest.join(' ') || first_name;
  // Creates the login (auth_service) AND the matching profile (user_service)
  // in one call — this account will never log in through the normal
  // register->login->createProfile flow to create its own profile, since
  // someone else (this admin) is creating it on its behalf.
  const response = await apiClient.post('/api/auth/admin/create-admin', {
    email: data.email,
    password: data.password,
    first_name,
    last_name,
  });
  return {
    id: String(response.data.id),
    user_id: String(response.data.id),
    email: response.data.email,
    full_name: data.full_name,
    role: 'admin',
    is_active: response.data.is_active,
    created_at: new Date().toISOString(),
  };
};

// Deletes the account everywhere — the profile (user_service) and the login
// record (auth_service), same as deleteStudent above.
export const deleteSubAdmin = async (adminId: string): Promise<void> => {
  await apiClient.delete(`/api/users/${adminId}`);
  await apiClient.delete(`/api/auth/users/${adminId}`).catch(() => {});
};

// ── Video Module Management (aliases onto the real functions above) ─────────

export const getModulesForCourse = async (courseId: string): Promise<any[]> => {
  return getModules(courseId);
};

export const getMaterialsForVideo = async (
  courseId: string,
  moduleId: string,
  videoId: string
): Promise<any[]> => {
  const response = await apiClient.get(
    `/api/courses/${courseId}/modules/${moduleId}/materials`,
    {
      params: { lesson_id: videoId },
    }
  );
  return response.data.map(mapAdminMaterial);
};

// ── Class Packages — no such concept exists in Edura. ────────────────────

export interface ClassPackage {
  id: string;
  name: string;
  description: string | null;
  grade: number;
  stream_id: string | null;
  stream_name: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface ClassPackageCreateData {
  name: string;
  description?: string | null;
  grade: number;
  stream_id?: string | null;
  price: number;
  is_active?: boolean;
}

export interface ClassPackageUpdateData {
  name?: string;
  description?: string | null;
  grade?: number;
  stream_id?: string | null;
  price?: number;
  is_active?: boolean;
}

export interface ClassEnrollment {
  id: string;
  user_id: string;
  user_email: string | null;
  class_package_id: string;
  package_name: string | null;
  package_grade: number | null;
  payment_id: string | null;
  status: string;
  enrolled_at: string;
  expires_at: string | null;
}

// Class packages (enrollment_service) — grade bundles that unlock every course they cover.
const toNumberIds = (params?: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== '')
  );

export const getClassPackages = async (params?: {
  grade?: number;
  stream_id?: string;
  is_active?: boolean;
}): Promise<ClassPackage[]> => {
  const response = await apiClient.get(
    '/api/enrollments/admin/class-packages',
    { params: toNumberIds(params) }
  );
  return response.data;
};

const packageBody = (
  data: ClassPackageCreateData | ClassPackageUpdateData
) => ({
  ...data,
  stream_id: data.stream_id
    ? Number(data.stream_id)
    : data.stream_id === undefined
      ? undefined
      : null,
});

export const createClassPackage = async (
  data: ClassPackageCreateData
): Promise<ClassPackage> => {
  const response = await apiClient.post(
    '/api/enrollments/admin/class-packages',
    packageBody(data)
  );
  return response.data;
};

export const updateClassPackage = async (
  id: string,
  data: ClassPackageUpdateData
): Promise<ClassPackage> => {
  const response = await apiClient.patch(
    `/api/enrollments/admin/class-packages/${id}`,
    packageBody(data)
  );
  return response.data;
};

export const deleteClassPackage = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/enrollments/admin/class-packages/${id}`);
};

export const autoGenerateClassPackages = async (): Promise<{
  created: string[];
  count: number;
}> => {
  const response = await apiClient.post(
    '/api/enrollments/admin/class-packages/auto-generate'
  );
  return response.data;
};

export const getClassEnrollments = async (params?: {
  user_id?: string;
  class_package_id?: string;
}): Promise<ClassEnrollment[]> => {
  const response = await apiClient.get(
    '/api/enrollments/admin/class-enrollments',
    { params: toNumberIds(params) }
  );
  return response.data;
};

export const adminGrantClassEnrollment = async (data: {
  user_id: string;
  class_package_id: string;
  expires_at?: string;
}): Promise<any> => {
  const response = await apiClient.post(
    '/api/enrollments/admin/class-enrollments',
    {
      user_id: Number(data.user_id),
      class_package_id: Number(data.class_package_id),
      expires_at: data.expires_at || undefined,
    }
  );
  return response.data;
};

export const adminRevokeClassEnrollment = async (
  enrollmentId: string
): Promise<void> => {
  await apiClient.delete(
    `/api/enrollments/admin/class-enrollments/${enrollmentId}`
  );
};
