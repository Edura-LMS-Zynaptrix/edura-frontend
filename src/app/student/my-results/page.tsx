'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchMyAttempts, fetchMyProgress } from '@/lib/redux/slices/studentDashboardSlice'
import { 
  MasteryRadarChart, 
  PerformanceLineChart, 
  ComparisonBarChart 
} from '@/components/analytics/ProgressCharts'
import { 
  ChevronRight, 
  TrendingUp, 
  Timer, 
  Award, 
  Target, 
  Calendar,
  ChevronDown,
  ExternalLink
} from 'lucide-react'

export default function ResultsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth)
  const { attempts, loadingAttempts, progress, loadingProgress } = useAppSelector((state) => state.studentDashboard)

  const [mounted, setMounted] = useState(false)
  // Defaults to the list tab — Edura has no aggregate cross-course progress
  // endpoint, so the analytics tab has nothing to show until that exists.
  const [activeTab, setActiveTab ] = useState<'list' | 'analytics'>('list')
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const queryString = searchParams.toString()
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname
      router.push(`/login?callbackUrl=${encodeURIComponent(fullPath)}`)
    }
  }, [isAuthenticated, isInitialized, router, pathname, searchParams])

  useEffect(() => {
    if (!isAuthenticated) return
    if (attempts.length === 0) dispatch(fetchMyAttempts(50))
    if (!progress) dispatch(fetchMyProgress())
  }, [dispatch, isAuthenticated, attempts.length, progress])

  if (!mounted || !isInitialized || loadingAttempts || (loadingProgress && !progress)) {
    if (!mounted) return null
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
      </div>
    )
  }

  const scoreColor = (pct: number) => {
    if (pct >= 85) return 'text-emerald-600'
    if (pct >= 65) return 'text-blue-600'
    if (pct >= 40) return 'text-amber-600'
    return 'text-rose-600'
  }

  const radarData = progress?.subjects.map(s => ({
    subject: s.subject,
    score: s.best_score_pct
  })) || []

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-teal-600 font-black tracking-[0.2em] uppercase text-xs mb-2">Performance Dashboard</p>
              <h1 className="text-5xl font-black text-gray-900 tracking-tighter leading-none mb-4">
                Diagnostic Analysis
              </h1>
              <p className="text-gray-500 text-lg font-medium max-w-2xl">
                Comprehensive breakdown of your academic strengths, improvement trends, and exam precision.
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
               <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'analytics' ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
               >
                 <TrendingUp size={16} />
                 Analytics
               </button>
               <button 
                  onClick={() => setActiveTab('list')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'list' ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
               >
                 <Calendar size={16} />
                 Recent Raw Data
               </button>
            </div>
          </div>
        </div>

        {activeTab === 'analytics' && progress && (
          <div className="space-y-10 animate-in fade-in duration-700">
             
             {/* 1. Executive Summary & Radar */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Overview */}
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-10 shadow-xl shadow-teal-900/5 flex flex-col items-center border border-gray-100">
                   <div className="w-full mb-8 flex items-center justify-between">
                      <h2 className="text-2xl font-black text-gray-800 tracking-tight">Mastery Signature</h2>
                      <div className="px-4 py-1.5 bg-teal-50 text-teal-700 text-[10px] font-black uppercase tracking-widest rounded-full">
                         Dynamic Comparison
                      </div>
                   </div>
                   <MasteryRadarChart data={radarData} />
                   <p className="text-gray-400 text-xs mt-6 text-center italic">
                     Your strength index mapped across all enrolled subjects based on your personal bests.
                   </p>
                </div>

                {/* KPI Stack */}
                <div className="flex flex-col gap-6">
                   <div className="flex-1 bg-gradient-to-br from-teal-600 to-teal-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-teal-600/20 flex flex-col justify-between">
                      <Award size={40} className="opacity-40" />
                      <div>
                         <p className="text-teal-100 text-xs font-black uppercase tracking-widest mb-1">Global Accuracy</p>
                         <p className="text-6xl font-black">{progress.overall.avg_score_pct}%</p>
                         <p className="text-teal-100/60 text-xs mt-2 italic">Calculated across {progress.overall.total_attempts_made} diagnostic attempts.</p>
                      </div>
                   </div>
                   
                   <div className="flex-1 bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 flex flex-col justify-between">
                      <Timer size={40} className="text-purple-600 opacity-20" />
                      <div>
                         <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">Processing Speed</p>
                         <p className="text-4xl font-black text-purple-600">
                            {Math.round(progress.overall.avg_time_seconds / 60)} <span className="text-xl">min/exam</span>
                         </p>
                         <p className="text-gray-400 text-xs mt-2 italic">Average focus duration per attempt.</p>
                      </div>
                   </div>
                </div>
             </div>

             {/* 2. Detailed Subject Breakdown */}
             <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                   <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Subject Precision</h2>
                   <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      Score Trend
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {progress.subjects.map((subj, idx) => (
                     <div 
                        key={idx} 
                        className={`group bg-white rounded-[2rem] border border-gray-100 p-8 transition-all hover:shadow-2xl hover:shadow-teal-900/10 cursor-pointer overflow-hidden relative ${selectedSubject === subj.subject ? 'ring-2 ring-teal-600' : ''}`}
                        onClick={() => setSelectedSubject(selectedSubject === subj.subject ? null : subj.subject)}
                     >
                        <div className="flex items-start justify-between mb-8 relative z-10">
                           <div>
                              <h3 className="text-2xl font-black text-gray-800 leading-tight">{subj.subject}</h3>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{subj.course_title}</p>
                           </div>
                           <div className="bg-teal-50 text-teal-600 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl group-hover:scale-110 transition-transform">
                              {subj.best_score_pct}%
                           </div>
                        </div>

                        <div className="h-[120px] -mx-4">
                           <PerformanceLineChart 
                              data={subj.score_trend?.map((s, i) => ({ name: `Attempt ${i+1}`, score: s })) || []} 
                           />
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-50">
                           <div className="text-center">
                              <p className="text-[9px] font-black text-gray-400 uppercase">Avg Score</p>
                              <p className="text-lg font-black text-gray-700">{subj.avg_score_pct}%</p>
                           </div>
                           <div className="text-center">
                              <p className="text-[9px] font-black text-gray-400 uppercase">Speed</p>
                              <p className="text-lg font-black text-gray-700">{Math.round(subj.avg_time_seconds / 60)}m</p>
                           </div>
                           <div className="text-center">
                              <p className="text-[9px] font-black text-gray-400 uppercase">Attempts</p>
                              <p className="text-lg font-black text-gray-700">{subj.total_attempts_count}</p>
                           </div>
                        </div>

                        {/* Drill Down View (Selected) */}
                        {selectedSubject === subj.subject && (
                          <div className="mt-10 animate-in slide-in-from-top-4 duration-300">
                             <p className="text-xs font-black text-teal-600 uppercase mb-4 tracking-widest flex items-center gap-2">
                                <ChevronDown size={14} />
                                Diagnostic Exam List
                             </p>
                             <div className="space-y-3">
                                {subj.exams.map((ex, exIdx) => (
                                  <div key={exIdx} className="bg-teal-50/50 rounded-2xl p-4 flex items-center justify-between">
                                     <div className="min-w-0">
                                        <p className="font-bold text-gray-800 truncate text-sm">{ex.title}</p>
                                        <p className="text-[10px] text-teal-600 font-bold uppercase">{ex.attempts_count} Attempts Made</p>
                                     </div>
                                     <div className="text-right shrink-0">
                                        <div className="flex items-center gap-2">
                                           <span className="text-xs font-black text-gray-400 uppercase">Best:</span>
                                           <span className="text-lg font-black text-teal-700">{ex.best_score_pct}%</span>
                                        </div>
                                     </div>
                                  </div>
                                ))}
                             </div>
                          </div>
                        )}
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {/* Recent Data Tab */}
        {activeTab === 'list' && (
          <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 p-8">
            {attempts.length === 0 ? (
               <div className="py-24 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Calendar className="text-gray-300" size={32} />
                  </div>
                  <p className="text-gray-400 font-black text-xl">No diagnostic data detected yet.</p>
                  <p className="text-gray-400 mt-2 font-medium">Your progress will appear here after your first exam attempt.</p>
               </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-8 px-2">
                   <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase italic">Historical Logs</h2>
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Grouped by Assessment</p>
                </div>

                {/* Grouping attempts by exam_id */}
                {Object.values(attempts.reduce((acc: any, a: any) => {
                  if (!acc[a.exam_id]) acc[a.exam_id] = { ...a, all_attempts: [] }
                  acc[a.exam_id].all_attempts.push(a)
                  return acc
                }, {})).map((exam: any) => (
                  <div key={exam.exam_id} className="bg-gray-50/50 rounded-[2rem] border border-gray-100 overflow-hidden">
                    {/* Exam Summary Header */}
                    <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 bg-white">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-600/20">
                          <Target size={24} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight truncate">{exam.exam_title}</h3>
                          <p className="text-[10px] text-teal-600 font-black uppercase tracking-widest">{exam.subject} • {exam.course_title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="text-center">
                          <p className="text-[9px] font-black text-gray-400 uppercase">Total Attempts</p>
                          <p className="text-lg font-black text-gray-800">{exam.all_attempts.length}</p>
                        </div>
                        <div className="w-px h-8 bg-gray-200" />
                        <div className="text-right">
                          <p className="text-[9px] font-black text-gray-400 uppercase">Latest Result</p>
                          <p className={`text-lg font-black ${scoreColor(Math.floor((exam.all_attempts[0].marks_obtained / exam.all_attempts[0].total_questions) * 100))}`}>
                            {exam.all_attempts[0].marks_obtained}/{exam.all_attempts[0].total_questions}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Attempt List Expansion */}
                    <div className="p-4 md:p-6 space-y-3">
                      {exam.all_attempts.map((att: any, idx: number) => {
                        const pct = att.total_questions ? Math.floor((att.marks_obtained / att.total_questions) * 100) : 0
                        return (
                          <div 
                            key={att.attempt_id} 
                            className="bg-white rounded-2xl p-4 md:px-6 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-gray-100 transition-all hover:border-teal-200 hover:shadow-sm group"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${pct >= 85 ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>
                                {att.attempt_number}
                              </div>
                              <div>
                                <p className="text-sm font-black text-gray-800">Attempt #{att.attempt_number}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                                  {att.submitted_at ? new Date(att.submitted_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Processing...'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-8 flex-grow">
                              <div className="flex items-center gap-6">
                                <div className="text-center">
                                  <p className="text-[8px] font-black text-gray-400 uppercase">Score</p>
                                  <p className={`text-sm font-black ${scoreColor(pct)}`}>{pct}%</p>
                                </div>
                                <div className="text-center hidden sm:block">
                                  <p className="text-[8px] font-black text-gray-400 uppercase">Speed</p>
                                  <p className="text-sm font-black text-gray-600">{Math.round(att.time_taken_seconds / 60)}m</p>
                                </div>
                                <div className="text-center hidden lg:block">
                                  <p className="text-[8px] font-black text-gray-400 uppercase">District Rank</p>
                                  <p className="text-sm font-black text-blue-500">#{att.district_rank || '-'}</p>
                                </div>
                              </div>

                              <button 
                                onClick={() => router.push(`/student/my-results/attempt/${att.attempt_id}`)}
                                className="px-5 py-2.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-teal-600 transition-all flex items-center gap-2 group-hover:scale-105"
                              >
                                Review Paper
                                <ExternalLink size={12} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
