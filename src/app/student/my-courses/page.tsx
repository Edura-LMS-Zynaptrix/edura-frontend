'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchMyEnrollments } from '@/lib/redux/slices/studentDashboardSlice'
import { BookOpen, Book, GraduationCap, ArrowRight, Video, Clock, AlertTriangle, Layers } from 'lucide-react'

export default function MyCoursesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()

  const { isAuthenticated, isInitialized, needsProfileCompletion } = useAppSelector((state) => state.auth)
  
  const { enrollments, loadingEnrollments } = useAppSelector(
    (state) => state.studentDashboard
  )

  // ── Filters State ──────────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'exam'>('all')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const queryString = searchParams.toString()
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname
      router.push(`/login?callbackUrl=${encodeURIComponent(fullPath)}`)
    }
  }, [isAuthenticated, isInitialized, router, pathname, searchParams])

  useEffect(() => {
    if (!isAuthenticated) return
    // Fetch all enrollments
    dispatch(fetchMyEnrollments())
  }, [dispatch, isAuthenticated])

  const enrolledCourses = useMemo(() => {
    if (!enrollments?.courses) return []
    
    return enrollments.courses.filter(cItem => {
      if (typeFilter === 'all') return true
      if (typeFilter === 'video') return cItem.course.course_type === 'video'
      if (typeFilter === 'exam') return cItem.course.course_type === 'exam'
      return true
    })
  }, [enrollments, typeFilter])

  const ExpiryBadge = ({ expiresAt }: { expiresAt?: string | null }) => {
    if (!expiresAt) return null
    const now = Date.now()
    const expMs = new Date(expiresAt).getTime()
    const diffMs = expMs - now
    if (diffMs <= 0) return (
      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
        <AlertTriangle size={10} /> Expired
      </span>
    )
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const isUrgent = days <= 30
    return (
      <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
        isUrgent ? 'text-orange-600 bg-orange-50' : 'text-gray-500 bg-gray-100'
      }`}>
        <Clock size={10} />
        {days}d left
      </span>
    )
  }

  const ProgressBar = ({ percentage, color = 'indigo' }: { percentage: number; color?: 'indigo' | 'teal' }) => {
    const isTeal = color === 'teal';
    const textCompletedColor = 'text-green-600 bg-green-50';
    const textColor = isTeal ? 'text-teal-600 bg-teal-50' : 'text-indigo-600 bg-indigo-50';
    const barCompletedColor = 'bg-green-500';
    const barColor = isTeal ? 'bg-teal-500' : 'bg-indigo-500';

    return (
      <div className="w-full mt-auto pt-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progress</span>
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${percentage === 100 ? textCompletedColor : textColor}`}>
            {percentage === 100 ? 'COMPLETED' : `${percentage}%`}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ease-out rounded-full ${percentage === 100 ? barCompletedColor : barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }

  if (!mounted || !isInitialized || loadingEnrollments) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your classroom...</p>
        </div>
      </div>
    )
  }

  if (needsProfileCompletion) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">My Classroom</h1>
            <p className="text-gray-500 mt-1 font-medium">Access your enrolled courses and track your progress.</p>
          </div>
          
          <div className="flex items-center gap-3">
             <Link
              href="/student/courses"
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm active:scale-95 text-sm"
            >
              Browse More Courses
            </Link>
          </div>
        </div>

        {/* Filter Hub */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Filter by Type</label>
              <div className="flex flex-wrap p-1 bg-gray-100 rounded-xl w-fit">
                {(['all', 'video', 'exam'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-6 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                      typeFilter === type 
                        ? 'bg-white text-teal-600 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {type === 'all' ? 'All Courses' : type === 'video' ? 'Video Classes' : 'Paper Classes'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Courses Grid */}
        {enrolledCourses.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 sm:p-16 text-center shadow-sm">
            <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-teal-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No courses found</h2>
            <p className="text-gray-500 mb-6 font-medium">You haven't enrolled in any courses that match your filters yet.</p>
            <Link href="/student/courses" className="px-6 py-3 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-100">
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {enrolledCourses.map((cItem: any) => {
              const isVideo = cItem.course.course_type === 'video'
              const themeColor = isVideo ? 'indigo' : 'teal'
              
              const gradientClass = isVideo ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-teal-500 to-teal-700';
              const badgeTextClass = isVideo ? 'text-indigo-700' : 'text-teal-700';
              const iconClass = isVideo ? 'text-indigo-400' : 'text-teal-400';
              const btnClass = isVideo ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700' : 'bg-teal-50 hover:bg-teal-100 text-teal-700';

              return (
                <div key={cItem.course.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group">
                  <div className="relative h-40">
                      {cItem.course.image_url ? (
                        <img src={cItem.course.image_url} alt={cItem.course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className={`w-full h-full ${gradientClass}`} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                         <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-white/90 backdrop-blur ${badgeTextClass} px-2 py-1 rounded-md shadow-sm`}>
                            {isVideo ? <Video size={12} /> : <BookOpen size={12} />}
                            {isVideo ? 'VIDEO CLASS' : 'PAPER CLASS'}
                         </span>
                         {(cItem as any).enrollment_type === 'class_package' && (
                           <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-teal-600/90 backdrop-blur text-white px-2 py-1 rounded-md shadow-sm">
                             <Layers size={10} /> Class Access
                           </span>
                         )}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4 text-white">
                        <h3 className="font-bold text-lg leading-tight line-clamp-2">{cItem.course.title}</h3>
                      </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-4">
                        <span className="flex items-center gap-1.5"><Book className={`w-4 h-4 ${iconClass}`} />{cItem.course.subject}</span>
                        <span className="flex items-center gap-1.5"><GraduationCap className={`w-4 h-4 ${iconClass}`} />Grade {cItem.course.grade}</span>
                        <ExpiryBadge expiresAt={cItem.expires_at} />
                      </div>
                      
                      <ProgressBar percentage={cItem.progress_percentage || 0} color={themeColor} />

                      <Link 
                        href={`/student/courses/${cItem.course.id}`}
                        className={`w-full py-3 rounded-xl font-bold text-center transition-all flex items-center justify-center gap-2 mt-auto group/btn ${btnClass}`}
                      >
                        OPEN CLASSROOM
                        <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
