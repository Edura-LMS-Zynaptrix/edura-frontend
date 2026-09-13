'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import {
  fetchCourseOverview,
  fetchCourseExams,
  enrollFreeSubCourseThunk,
  enrollFreeCourseThunk,
  enrollFreeVideoCourseThunk,
  enrollFreeModuleThunk
} from '@/lib/redux/slices/coursesSlice'
import { fetchPublicStreams } from '@/lib/redux/slices/adminSlice'
import { ExamWithAccess } from '@/lib/api/student'
import { getAllOngoingExams, getSecondsRemaining, type OngoingExamEntry } from '@/lib/ongoingExam'
import { StatusModal } from '@/components/StatusModal'
import { Clock, AlertTriangle } from 'lucide-react'

export default function CourseOverviewPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params?.courseId as string
  const dispatch = useAppDispatch()

  const { currentCourse: course, currentCourseExams: exams, studentLoading: loading, studentError: error } = useAppSelector(state => state.courses)
  const { streams } = useAppSelector(state => state.admin)
  const { isAuthenticated, needsProfileCompletion } = useAppSelector(state => state.auth)

  if (needsProfileCompletion) return null
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [statusModal, setStatusModal] = useState<{ title: string; message: string; type: 'info' | 'error' | 'warning' | 'success'; onConfirm?: () => void } | null>(null)

  // ── Ongoing exam tracking ─────────────────────────────────────────────
  // Map of examId → { entry, secondsLeft } updated every second
  const [ongoingMap, setOngoingMap] = useState<Record<string, { entry: OngoingExamEntry; secondsLeft: number }>>({})
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const refresh = () => {
      const all = getAllOngoingExams()
      const map: Record<string, { entry: OngoingExamEntry; secondsLeft: number }> = {}
      all.forEach((e) => { map[e.examId] = { entry: e, secondsLeft: getSecondsRemaining(e) } })
      setOngoingMap(map)
    }
    refresh()
    tickRef.current = setInterval(refresh, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  useEffect(() => {
    if (courseId) {
      dispatch(fetchCourseOverview(courseId))
      dispatch(fetchCourseExams(courseId))
    }
  }, [dispatch, courseId])

  useEffect(() => {
    if (streams.length === 0) {
      dispatch(fetchPublicStreams())
    }
  }, [dispatch, streams.length])



  const handleEnrollFreeSubCourse = async (subCourseId: string) => {
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    try {
      setEnrolling(subCourseId)
      await dispatch(enrollFreeSubCourseThunk(subCourseId)).unwrap()
      // Reload to update enrollment status
      dispatch(fetchCourseOverview(courseId))
    } catch (err: any) {
      setStatusModal({
        title: 'Enrollment Failed',
        message: err || 'Failed to enroll in sub-course. Please try again.',
        type: 'error'
      })
    } finally {
      setEnrolling(null)
    }
  }

  const handleEnrollFreeCourse = async () => {
    if (!course) return
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    try {
      setEnrolling('course')
      await dispatch(enrollFreeCourseThunk(courseId)).unwrap()
      dispatch(fetchCourseOverview(courseId))
    } catch (err: any) {
      setStatusModal({
        title: 'Enrollment Failed',
        message: err || 'Failed to enroll in free course. Please try again.',
        type: 'error'
      })
    } finally {
      setEnrolling(null)
    }
  }



  const handleEnrollFreeVideoCourse = async () => {
    if (!course) return
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    try {
      setEnrolling('course')
      await dispatch(enrollFreeVideoCourseThunk(courseId)).unwrap()
      dispatch(fetchCourseOverview(courseId))
    } catch (err: any) {
      setStatusModal({
        title: 'Enrollment Failed',
        message: err || 'Failed to enroll in free video course.',
        type: 'error'
      })
    } finally {
      setEnrolling(null)
    }
  }

  const handleEnrollFreeModule = async (moduleId: string) => {
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    try {
      setEnrolling(moduleId)
      await dispatch(enrollFreeModuleThunk(moduleId)).unwrap()
      dispatch(fetchCourseOverview(courseId))
    } catch (err: any) {
      setStatusModal({
        title: 'Enrollment Failed',
        message: err || 'Failed to enroll in free module.',
        type: 'error'
      })
    } finally {
      setEnrolling(null)
    }
  }


  const handlePurchaseCourse = () => {
    if (!course) return
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    router.push(`/payment?type=course&id=${course.id}&name=${encodeURIComponent(course.title)}&amount=${course.price}`)
  }

  const handleStartExam = (examId: string) => {
    router.push(`/student/exams/${examId}`)
  }

  const ProgressBar = ({ percentage, label }: { percentage: number; label?: string }) => (
    <div className="w-full mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label || 'Section Progress'}</span>
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${percentage === 100 ? 'text-green-600 bg-green-50' : 'text-teal-600 bg-teal-50'}`}>
          {percentage === 100 ? (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
              Completed
            </span>
          ) : `${percentage}%`}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-50 flex-1">
        <div 
          className={`h-full transition-all duration-1000 ease-out rounded-full ${
            percentage === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-teal-500 to-emerald-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Preparing your course overview...</p>
        </div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {typeof error === 'string' ? error : 'Course series not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Status Modal replacement for alert() */}
      {statusModal && (
        <StatusModal
          title={statusModal.title}
          message={statusModal.message}
          type={statusModal.type}
          onConfirm={() => {
            if (statusModal.onConfirm) statusModal.onConfirm()
            setStatusModal(null)
          }}
        />
      )}

      {/* Course Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <button
            onClick={() => router.push('/student/courses')}
            className="text-gray-400 hover:text-gray-600 pt-5 mb-4 flex items-center gap-1.5 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Exams / Courses
          </button>

          {/* Course Banner Image */}
          {course.image_url ? (
            <div className="relative h-48 sm:h-64 rounded-xl overflow-hidden mb-5">
              <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-5 sm:right-5 flex flex-wrap items-end justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {course.stream_ids && course.stream_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {course.stream_ids.map(sid => (
                        <span key={sid} className="text-[11px] sm:text-xs font-semibold text-white/80 bg-white/20 backdrop-blur-sm px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                          {streams.find(s => s.id === sid)?.name || 'Stream'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {course.is_enrolled && (
                  <span className="text-[11px] sm:text-xs text-white font-semibold flex items-center gap-1 bg-green-500/90 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    Enrolled
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="relative h-32 rounded-xl overflow-hidden mb-5 bg-gradient-to-br from-teal-500 to-teal-700">
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-5 sm:right-5 flex flex-wrap items-end justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {course.stream_ids && course.stream_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {course.stream_ids.map(sid => (
                        <span key={sid} className="text-[11px] sm:text-xs font-semibold text-white/80 bg-white/20 backdrop-blur-sm px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                          {streams.find(s => s.id === sid)?.name || 'Stream'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {course.is_enrolled && (
                  <span className="text-[11px] sm:text-xs text-white font-semibold flex items-center gap-1 bg-green-500/90 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    Enrolled
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="pb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight mb-1">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-gray-500 line-clamp-2">{course.description}</p>
            )}

            {course.is_enrolled && (
              <div className="mt-5 bg-teal-50/50 p-4 rounded-2xl border border-teal-100/50">
                 <ProgressBar percentage={course.progress_percentage || 0} label="Overall Learning Progress" />
                 <p className="text-[10px] text-teal-600 font-medium italic mt-1">Keep it up! Each completed lesson and exam brings you closer to your goal.</p>
                 {course.enrollment_expires_at && (() => {
                   const diffMs = new Date(course.enrollment_expires_at).getTime() - Date.now()
                   const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                   const expired = diffMs <= 0
                   const urgent = !expired && days <= 30
                   return (
                     <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                       expired ? 'bg-red-50 text-red-600 border border-red-100' :
                       urgent  ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                 'bg-white/70 text-gray-500 border border-teal-100'
                     }`}>
                       {expired ? <AlertTriangle size={14} /> : <Clock size={14} />}
                       {expired
                         ? 'Access expired — please re-enroll to continue.'
                         : urgent
                           ? `Access expires in ${days} day${days !== 1 ? 's' : ''} — renew soon!`
                           : `Access valid for ${days} more day${days !== 1 ? 's' : ''} (until ${new Date(course.enrollment_expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })})`
                       }
                     </div>
                   )
                 })()}
              </div>
            )}

            {/* Course-level action */}
            {!course.is_enrolled ? (
              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-gray-400 font-medium">For full course</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900">
                    {course.price === 0 ? <span className="text-green-600">Free</span> : `LKR ${course.price.toLocaleString()}`}
                  </p>
                </div>
                {course.price === 0 ? (
                  <button
                    onClick={course.course_type === 'video' ? handleEnrollFreeVideoCourse : handleEnrollFreeCourse}
                    disabled={enrolling === 'course'}
                    className="w-full sm:w-auto px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {enrolling === 'course' ? 'Enrolling...' : 'Enroll Now'}
                  </button>
                ) : (
                  <button
                    onClick={handlePurchaseCourse}
                    className="w-full sm:w-auto px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    Purchase Course
                  </button>
                )}
              </div>
            ) : course.course_type === 'video' && (
              <div className="mt-4">
                 <button
                    onClick={() => router.push(`/student/video-classes/${course.id}`)}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Continue Video Class
                  </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assessments — Edura attaches assessments directly to a course
          (no sub-course grouping), so this always shows alongside modules. */}
      {exams.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Assessments</h2>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50">
            {exams.map((exam) => {
              const isAccessible = course.is_enrolled || exam.is_enrolled
              return (
                <div key={exam.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50/80 transition-colors">
                  <div className="w-10 h-10 rounded-xl shrink-0 bg-gray-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">{exam.title}</h4>
                    <div className="text-[11px] sm:text-xs text-gray-400">
                      {exam.duration_minutes > 0 ? `${exam.duration_minutes} Minutes` : 'No time limit'}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isAccessible ? (
                      ongoingMap[exam.id] ? (
                        <button
                          onClick={() => handleStartExam(exam.id)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          {String(Math.floor(ongoingMap[exam.id].secondsLeft / 60)).padStart(2, '0')}:{String(ongoingMap[exam.id].secondsLeft % 60).padStart(2, '0')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartExam(exam.id)}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Start
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">Enroll to unlock</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modules & Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {course.course_type === 'video' ? (
           // Render Video Class Modules
           (!course.modules || course.modules.length === 0) ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">No video modules added yet.</p>
            </div>
           ) : (
             <div className="space-y-8">
               {course.modules.map((module: any) => {
                 const isUnlocked = course.is_enrolled || module.is_enrolled
                 return (
                   <div key={module.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {/* Module Header */}
                      <div className="relative">
                        {module.image_url ? (
                          <div className="h-40 sm:h-52">
                            <img src={module.image_url} alt={module.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                          </div>
                        ) : (
                          <div className="h-28 bg-gradient-to-br from-indigo-500 to-indigo-700" />
                        )}
                        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest bg-black/30 px-2 py-0.5 rounded-md backdrop-blur-sm">Module {module.order_number}</span>
                            <h3 className="text-lg font-bold text-white mt-1 drop-shadow-sm">{module.title}</h3>
                          </div>
                          {isUnlocked && (
                            <span className="bg-green-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-sm">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                              UNLOCKED
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-5">
                        {module.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 mb-4">{module.description}</p>
                        )}

                        {!isUnlocked ? (
                          <div className="flex items-center justify-between gap-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                            <div>
                               <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Module Locked</p>
                               <p className="text-sm font-medium text-gray-700">
                                 Please enroll in the course to access this module.
                               </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {/* Progress Bar for enrolled modules */}
                            <ProgressBar percentage={module.progress_percentage || 0} />
                            
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                 <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{module.video_count || 0} Lessons</span>
                                 <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Materials</span>
                              </div>
                              <button onClick={() => router.push(`/student/video-classes/${course.id}`)} className="w-full sm:w-auto px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2">
                                Watch Lessons
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                   </div>
                 )
               })}
             </div>
           )
        ) : (
          // Render Paper Class Sub-Courses (Existing logic)
          (!course.sub_courses || course.sub_courses.length === 0) ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">No content added yet.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {course.sub_courses.map((subCourse) => {
                const isUnlocked = course.is_enrolled || subCourse.is_enrolled
                return (
                  <div key={subCourse.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {/* Module Image Banner */}
                    {subCourse.image_url ? (
                      <div className="relative h-36 sm:h-48">
                        <img src={subCourse.image_url} alt={subCourse.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-4 flex flex-wrap items-end justify-between gap-2">
                          <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">Module {subCourse.order_number || 1}</span>
                          {isUnlocked && (
                            <span className="text-[11px] text-white font-semibold flex items-center gap-1 bg-green-500/90 px-2 py-0.5 rounded-full">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                              Enrolled
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-24 sm:h-28 bg-gradient-to-br from-teal-500 to-teal-700">
                        <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-4 flex flex-wrap items-end justify-between gap-2">
                          <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">Module {subCourse.order_number || 1}</span>
                          {isUnlocked && (
                            <span className="text-[11px] text-white font-semibold flex items-center gap-1 bg-green-500/90 px-2 py-0.5 rounded-full">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                              Enrolled
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Module Info */}
                    <div className="px-3 sm:px-5 pt-4 pb-3 border-b border-gray-100">
                      <h3 className="text-base font-bold text-gray-900 leading-snug">{subCourse.title}</h3>
                      {subCourse.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2 mb-3">{subCourse.description}</p>
                      )}
                      
                      {isUnlocked && (
                        <div className="mt-2">
                           <ProgressBar percentage={subCourse.progress_percentage || 0} label="Curriculum Progress" />
                        </div>
                      )}

                      {!isUnlocked && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Module Locked</p>
                           <p className="text-xs text-gray-600 mt-1">Enroll in the course to unlock these exams.</p>
                        </div>
                      )}
                    </div>

                    {/* Exams */}
                    {subCourse.exams && subCourse.exams.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {subCourse.exams.map((exam) => {
                          const isAccessible = exam.is_enrolled || subCourse.is_enrolled || course.is_enrolled
                          const isScheduledFuture = exam.scheduled_start && new Date(exam.scheduled_start) > new Date()
                          return (
                            <div key={exam.id} className={`flex items-start sm:items-center gap-3 px-3 sm:px-5 py-3 transition-colors ${exam.is_locked ? 'bg-gray-50/30' : 'hover:bg-gray-50/80'}`}>
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center relative">
                                 {exam.is_locked && (
                                  <div className="absolute inset-0 bg-gray-900/10 z-10 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-gray-500 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                  </div>
                                )}
                                {exam.image_url ? (
                                  <img src={exam.image_url} alt={exam.title} className="w-full h-full object-cover" />
                                ) : (
                                  <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className={`text-sm font-medium truncate ${exam.is_locked ? 'text-gray-500' : 'text-gray-900'}`}>{exam.title}</h4>
                                  {exam.is_locked && (
                                     <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded shrink-0 uppercase tracking-widest">Locked</span>
                                  )}
                                  {exam.already_attempted && !exam.is_locked && (
                                     <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${exam.is_passed ? 'text-teal-600 bg-teal-50' : 'text-amber-600 bg-amber-50'}`}>
                                       {exam.is_passed ? 'Completed' : 'Retake Exam'}
                                     </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] sm:text-xs text-gray-400">
                                  <span>{exam.total_questions} Questions</span>
                                  <span className="hidden sm:inline">·</span>
                                  <span>{exam.duration_minutes} Minutes</span>
                                  {exam.scheduled_start && (
                                    <>
                                      <span className="hidden sm:inline">·</span>
                                      <span className={isScheduledFuture ? 'text-orange-500 font-medium' : ''}>
                                        {new Date(exam.scheduled_start).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {exam.is_locked && exam.lock_message && isAccessible && (
                                  <div className={`mt-3 flex items-start gap-3 p-4 rounded-xl border-l-4 transition-all shadow-sm ${
                                    exam.lock_reason === 'score_too_low' 
                                      ? 'bg-red-50 border-red-500 border-y-red-100 border-r-red-100 text-red-900' 
                                      : 'bg-amber-50 border-amber-500 border-y-amber-100 border-r-amber-100 text-amber-900'
                                  } max-w-2xl`}>
                                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                      exam.lock_reason === 'score_too_low' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                    }`}>
                                      {exam.lock_reason === 'score_too_low' ? (
                                        <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                      ) : (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${exam.lock_reason === 'score_too_low' ? 'text-red-700' : 'text-amber-700'}`}>
                                        {exam.lock_reason === 'score_too_low' ? '🔒 Action Required: Score Too Low' : '🔒 Action Required:'}
                                      </p>
                                      <p className="text-[14px] font-semibold leading-relaxed">
                                        {exam.lock_message}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center justify-end">
                                {exam.is_locked ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <button
                                      disabled
                                      className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold cursor-not-allowed border-2 border-amber-200/50 flex items-center gap-2 shadow-sm transition-all opacity-100"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                      LOCKED
                                    </button>
                                  </div>
                                ) : isAccessible ? (
                                  isScheduledFuture ? (
                                    <span className="text-xs text-orange-400 font-medium">Scheduled</span>
                                  ) : ongoingMap[exam.id] ? (
                                    <button
                                      onClick={() => handleStartExam(exam.id)}
                                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                    >
                                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                      {String(Math.floor(ongoingMap[exam.id].secondsLeft / 60)).padStart(2,'0')}:{String(ongoingMap[exam.id].secondsLeft % 60).padStart(2,'0')}
                                    </button>
                                  ) : (
                                    <div className="flex gap-2">
                                      {exam.already_attempted && (
                                        <button
                                          onClick={() => router.push(`/student/exams/${exam.id}?view=results`)}
                                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors"
                                        >
                                          Results
                                        </button>
                                      )}
                                      {(!exam.already_attempted || !exam.is_passed) && (
                                        <button
                                          onClick={() => handleStartExam(exam.id)}
                                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors"
                                        >
                                          {exam.already_attempted ? 'Retake' : 'Start'}
                                        </button>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  <div className="flex flex-col items-end gap-1">
                                    <button
                                      disabled
                                      className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold cursor-not-allowed border-2 border-amber-200/50 flex items-center gap-2 shadow-sm transition-all opacity-100"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                      LOCKED
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="px-3 sm:px-5 py-6 text-center">
                        <p className="text-xs text-gray-300 italic">No exams yet</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
