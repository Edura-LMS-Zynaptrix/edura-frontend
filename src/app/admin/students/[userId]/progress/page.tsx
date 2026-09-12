'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchStudentProgress, sendStudentReportAction, clearAdminError } from '@/lib/redux/slices/adminSlice'
import { toast } from 'react-hot-toast'
import { 
  MasteryRadarChart, 
  PerformanceLineChart 
} from '@/components/analytics/ProgressCharts'
import { 
  TrendingUp, 
  Timer, 
  Award, 
  Phone, 
  Mail, 
  ChevronDown, 
  ArrowLeft,
  Calendar,
  Zap,
  Target,
  ExternalLink
} from 'lucide-react'

export default function AdminStudentProgressPage() {
  const params = useParams()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const userId = params.userId as string

  const { 
    selectedStudentProgress: data, 
    progressLoading: loading, 
    reportLoading: sendingReport,
    error 
  } = useAppSelector((s) => s.admin)
  
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)
  const [activeTab, setActiveTab ] = useState<'analytics' | 'list'>('analytics')

  useEffect(() => {
    if (userId) {
      dispatch(fetchStudentProgress(userId))
    }
    return () => {
      dispatch(clearAdminError())
    }
  }, [userId, dispatch])

  const handleSendReport = async () => {
    if (!userId) return
    const resultAction = await dispatch(sendStudentReportAction(userId))
    if (sendStudentReportAction.fulfilled.match(resultAction)) {
      toast.success(resultAction.payload.message || 'Report sent successfully')
    } else {
      toast.error((resultAction.payload as string) || 'Failed to send report')
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
        <p className="text-gray-500 font-bold animate-pulse uppercase tracking-widest text-xs">Assembling Diagnostic Data...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-white border border-red-100 p-10 rounded-[2.5rem] shadow-2xl text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
           <Zap size={40} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Calculation Error</h2>
        <p className="text-gray-500 mb-8 font-medium">{error}</p>
        <button onClick={() => router.back()} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">
          Return to Console
        </button>
      </div>
    </div>
  )

  if (!data) return null

  const { student, overall, subjects } = data
  const radarData = subjects.map(s => ({ subject: s.subject, score: s.best_score_pct }))

  const scoreColor = (pct: number) => {
    if (pct >= 85) return 'text-emerald-600'
    if (pct >= 65) return 'text-blue-600'
    if (pct >= 40) return 'text-amber-600'
    return 'text-rose-600'
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] pb-24">
      {/* Premium Admin Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-xl transition-all border border-gray-100 text-gray-400 hover:text-gray-900">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-1">
                 {student.full_name}
              </h1>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                 <span>Grade {student.grade}</span>
                 <span className="w-1 h-1 bg-gray-200 rounded-full" />
                 <span>{student.district}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
               <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'analytics' ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}
               >
                 <TrendingUp size={14} />
                 Analytics
               </button>
               <button 
                  onClick={() => setActiveTab('list')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'list' ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}
               >
                 <Calendar size={14} />
                 Recent Raw Data
               </button>
            </div>

            <button
              onClick={handleSendReport}
              disabled={sendingReport}
              className="flex items-center gap-2 bg-gray-900 hover:bg-teal-600 disabled:bg-gray-300 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 group"
            >
              {sendingReport ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Mail size={16} className="group-hover:rotate-12 transition-transform" />
              )}
              <span className="hidden sm:inline">{sendingReport ? 'Dispatching...' : 'Dispatch Report'}</span>
              <span className="sm:hidden">{sendingReport ? '...' : <Mail size={16}/>}</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        {activeTab === 'analytics' ? (
          <div className="animate-in fade-in duration-500">
            {/* Diagnostic Snapshot */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
              
              {/* Radar Mastery */}
              <div className="lg:col-span-2 bg-white border border-gray-100 rounded-[3rem] p-10 shadow-xl shadow-gray-200/20 flex flex-col items-center">
                 <div className="w-full flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Mastery Signature</h3>
                    <Award size={20} className="text-teal-600" />
                 </div>
                 <MasteryRadarChart data={radarData} />
                 <p className="text-gray-400 text-[10px] mt-6 font-black uppercase tracking-widest text-center italic opacity-60">
                    Strength index based on personal bests across all subjects.
                 </p>
              </div>

              {/* Quick Metrics & Contact */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                 <div className="grid grid-cols-2 gap-6">
                    <MetricCard 
                       icon={<Zap size={20} className="text-amber-500" />} 
                       label="Efficiency" 
                       value={`${Math.round(overall.avg_time_seconds / 60)}m`} 
                       sub="Avg focus/exam"
                    />
                    <MetricCard 
                       icon={<Target size={20} className="text-teal-500" />} 
                       label="Total Volume" 
                       value={overall.total_attempts_made} 
                       sub="Attempts made"
                    />
                 </div>

                 <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                    <div className="flex items-center gap-2 mb-6 text-teal-400 relative z-10">
                       <Phone size={16} />
                       <span className="text-[10px] font-black uppercase tracking-widest">Counselor Contact</span>
                    </div>
                    <div className="space-y-6 relative z-10">
                       <div className="flex items-center justify-between cursor-pointer">
                          <div>
                             <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Student</p>
                             <p className="text-xl font-bold hover:text-teal-400 transition-colors">{student.phone_number || 'Not provided'}</p>
                          </div>
                          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:bg-teal-500 hover:text-white transition-all">
                             <Phone size={18} />
                          </div>
                       </div>
                       <div className="w-full h-px bg-white/5" />
                       <div className="flex items-center justify-between cursor-pointer">
                          <div>
                             <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Parent / Guardian</p>
                             <p className="text-xl font-bold hover:text-teal-400 transition-colors">{student.parent_phone_number || 'N/A'}</p>
                          </div>
                          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:bg-teal-500 hover:text-white transition-all">
                             <Phone size={18} />
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2 mb-4">
                 <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Diagnostic Deep-Dive</h2>
                 <TrendingUp className="text-gray-200" size={24} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {subjects.map((subj, idx) => (
                  <div 
                     key={idx} 
                     className={`group bg-white rounded-[2.5rem] p-10 border transition-all cursor-pointer ${expandedSubject === subj.subject ? 'border-teal-100 shadow-2xl shadow-teal-900/5' : 'border-gray-100 shadow-sm hover:shadow-xl'}`}
                     onClick={() => setExpandedSubject(expandedSubject === subj.subject ? null : subj.subject)}
                  >
                     <div className="flex items-start justify-between mb-8">
                        <div>
                           <span className="px-2 py-0.5 bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest rounded-md">{subj.course_title}</span>
                           <h3 className="text-2xl font-black text-gray-800 mt-2">{subj.subject}</h3>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Avg Accuracy</p>
                           <p className={`text-4xl font-black ${subj.avg_score_pct >= 80 ? 'text-emerald-500' : subj.avg_score_pct >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                              {subj.avg_score_pct}%
                           </p>
                        </div>
                     </div>

                     <div className="h-[140px] -mx-4">
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

                     {expandedSubject === subj.subject && (
                       <div className="mt-10 animate-in slide-in-from-top-4 duration-500">
                          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50">
                             <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest">Attempt Inventory</h4>
                             <span className="text-[10px] font-bold text-gray-400 uppercase">{subj.total_attempts_count} total entries</span>
                          </div>
                          <div className="space-y-3">
                             {subj.exams.map((ex, exIdx) => (
                               <div key={exIdx} className="bg-teal-50/50 rounded-2xl p-4 flex items-center justify-between">
                                  <div className="min-w-0">
                                     <p className="font-bold text-gray-800 truncate text-sm">{ex.title}</p>
                                     <p className="text-[10px] text-teal-600 font-bold uppercase">{ex.attempts_count} Attempts Found</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                     <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-gray-400 uppercase">Best:</span>
                                        <span className="text-lg font-black text-teal-700">{ex.best_score_pct}%</span>
                                     </div>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                     )}

                     {!expandedSubject && (
                       <div className="mt-8 flex items-center justify-center text-gray-300 group-hover:text-teal-500 transition-colors">
                          <ChevronDown size={24} />
                       </div>
                     )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-6 duration-700">
             <div className="flex items-center justify-between mb-10 px-2">
                <div>
                   <h2 className="text-4xl font-black text-gray-900 tracking-tighter italic uppercase">Historical Logs</h2>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Full pedagogical audit trail</p>
                </div>
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
                   <Calendar className="text-teal-600" size={24} />
                </div>
             </div>

             <div className="space-y-8">
               {subjects.flatMap(s => s.exams).filter(e => e.attempts_count > 0).map((exam) => (
                 <div key={exam.id} className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-xl shadow-gray-200/40 transition-all hover:shadow-2xl">
                    {/* Exam Summary Header */}
                    <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-gray-50 bg-white">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-gray-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-gray-900/20">
                          <Target size={28} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight truncate">{exam.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="px-2 py-0.5 bg-teal-50 text-teal-600 text-[10px] font-black uppercase tracking-widest rounded-md">Attempt Mastery View</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-8 bg-gray-50 p-4 rounded-3xl border border-gray-100">
                         <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Attempts</p>
                            <p className="text-2xl font-black text-gray-900">{exam.attempts_count}</p>
                         </div>
                         <div className="w-px h-10 bg-gray-200" />
                         <div className="text-right">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Max Accuracy</p>
                            <p className={`text-2xl font-black ${scoreColor(exam.best_score_pct)}`}>{exam.best_score_pct}%</p>
                         </div>
                      </div>
                    </div>

                    {/* Attempt Grid */}
                    <div className="p-6 md:p-10 bg-gray-50/30">
                       <div className="grid grid-cols-1 gap-4">
                          {exam.history.map((att, idx) => (
                            <div 
                               key={att.id} 
                               className="bg-white rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-gray-100 transition-all hover:border-teal-200 hover:shadow-md group"
                            >
                               <div className="flex items-center gap-5">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-sm ${att.score_pct >= 85 ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>
                                     {att.attempt_number}
                                  </div>
                                  <div>
                                     <p className="font-black text-gray-800 text-base leading-tight">Attempt #{att.attempt_number}</p>
                                     <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                                        {att.submitted_at ? new Date(att.submitted_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                     </p>
                                  </div>
                               </div>

                               <div className="flex items-center justify-between md:justify-end gap-12 flex-grow">
                                  <div className="flex items-center gap-8">
                                     <div className="text-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tight mb-1">Score</p>
                                        <p className={`text-xl font-black ${scoreColor(att.score_pct)}`}>{att.score_pct}%</p>
                                     </div>
                                     <div className="text-center hidden sm:block">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tight mb-1">Speed</p>
                                        <p className="text-lg font-black text-gray-600">{Math.round(att.time_seconds / 60)}m</p>
                                     </div>
                                  </div>

                                  <button 
                                     onClick={() => router.push(`/admin/students/${userId}/progress/attempt/${att.id}`)}
                                     className="px-6 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-teal-600 transition-all flex items-center gap-2 group-hover:scale-105 shadow-xl shadow-gray-900/10"
                                  >
                                    Review Results
                                    <ExternalLink size={14} />
                                  </button>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </main>
    </div>
  )
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode, label: string, value: string | number, sub: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between h-[160px]">
       <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
          {icon}
       </div>
       <div>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
          <p className="text-3xl font-black text-gray-900 leading-none mb-1">{value}</p>
          <p className="text-[10px] font-medium text-gray-400">{sub}</p>
       </div>
    </div>
  )
}

