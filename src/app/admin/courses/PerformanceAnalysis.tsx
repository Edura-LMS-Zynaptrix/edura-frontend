'use client'

import React, { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCourseStruggleAnalysis } from '@/lib/redux/slices/adminSlice'
import { 
  AlertCircle, 
  BookOpen, 
  FileText, 
  Trophy, 
  Users, 
  Loader2,
  TrendingDown,
  Info
} from 'lucide-react'

interface PerformanceAnalysisProps {
  courseId: string
  courseTitle: string
}

export const PerformanceAnalysis: React.FC<PerformanceAnalysisProps> = ({ courseId, courseTitle }) => {
  const dispatch = useAppDispatch()
  const { selectedCourseStruggle, struggleLoading, error } = useAppSelector(state => state.admin)

  useEffect(() => {
    if (courseId) {
      dispatch(fetchCourseStruggleAnalysis(courseId))
    }
  }, [courseId, dispatch])

  if (struggleLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-gray-500 animate-pulse font-medium">Analyzing first-attempt results...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center border-2 border-dashed rounded-xl border-red-200 bg-red-50">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-semibold text-red-900">Analysis Failed</h3>
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  if (!selectedCourseStruggle) return null

  const { overall_avg_score, overall_failure_rate, struggling_modules, hardest_exams } = selectedCourseStruggle

  return (
    <div className="space-y-8">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Avg Score Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow">
          <div className="p-4">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Overall Avg. Score</span>
            </div>
            <div className="text-3xl font-black text-gray-900">{overall_avg_score}%</div>
          </div>
          <div className="h-1.5 bg-indigo-50">
            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${overall_avg_score}%` }} />
          </div>
        </div>

        {/* Overall Failure Rate Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow">
          <div className="p-4">
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Overall Failure Rate</span>
            </div>
            <div className="text-3xl font-black text-rose-600">{overall_failure_rate}%</div>
          </div>
          <div className="h-1.5 bg-rose-50">
            <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${overall_failure_rate}%` }} />
          </div>
        </div>

        {/* Modules Count Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Modules Analyzed</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{struggling_modules.length}</div>
        </div>

        {/* Exams Count Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Exams Analyzed</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{hardest_exams.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Module breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
              <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
                <BookOpen className="w-4 h-4" />
              </div>
              Module Performance
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase">Sorted by Failure</span>
          </div>
          
          <div className="space-y-3">
            {struggling_modules.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed rounded-xl bg-gray-50/50">
                <p className="text-gray-400 text-sm italic">No relevant module data found.</p>
              </div>
            ) : (
              struggling_modules.map((module) => (
                <div key={module.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate pr-4">{module.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {module.total_students} Students
                        </span>
                        <span className="text-[10px] text-gray-400">|</span>
                        <span className="text-[10px] text-gray-500 uppercase font-bold">{module.type}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black ${module.failure_rate > 30 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {module.failure_rate}% Fail
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium">Avg Score: {module.avg_score}%</div>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                     <div className="flex justify-between text-[9px] uppercase tracking-tighter font-black text-gray-400">
                       <span>Struggle Indicator</span>
                       <span>{Math.round(module.failure_rate)}%</span>
                     </div>
                     <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                       <div 
                        className={`h-full transition-all duration-700 ${
                          module.failure_rate > 40 ? 'bg-rose-500' : module.failure_rate > 20 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} 
                        style={{ width: `${module.failure_rate}%` }} 
                       />
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Exam breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
              <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
                <FileText className="w-4 h-4" />
              </div>
              Hardest Specific Papers
            </h3>
            <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-full font-bold uppercase">Critical Items</span>
          </div>

          <div className="space-y-3">
            {hardest_exams.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed rounded-xl bg-gray-50/50">
                <p className="text-gray-400 text-sm italic">No individual paper results analyzed.</p>
              </div>
            ) : (
              hardest_exams.map((exam) => (
                <div key={exam.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-rose-300 transition-all border-l-4 border-l-rose-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 uppercase">{exam.title}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium italic">Analyzed from {exam.attempt_count} first attempts</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="bg-rose-600 text-white px-2 py-1 rounded text-[10px] font-black uppercase shadow-sm">
                        {exam.failure_rate}% Failed
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <div className="text-[9px] text-gray-400 uppercase font-black tracking-wider mb-0.5 text-center">Avg Score</div>
                      <div className={`text-base font-black text-center ${exam.avg_score < 50 ? 'text-rose-600' : 'text-emerald-600'}`}>{exam.avg_score}%</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <div className="text-[9px] text-gray-400 uppercase font-black tracking-wider mb-0.5 text-center">Pass Rate</div>
                      <div className="text-base font-black text-center text-gray-900">{(100 - exam.failure_rate).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Alert Panel */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Info className="w-24 h-24 rotate-12" />
        </div>
        <div className="relative z-10 flex items-start gap-5">
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner border border-white/30 hidden sm:block">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="font-black text-xl mb-1 flex items-center gap-2">
              Action Plan: Curriculum Refinement
            </h4>
            <p className="text-indigo-50 leading-relaxed text-sm max-w-2xl">
              Focus your attention on modules with <span className="font-bold text-white underline decoration-rose-400 underline-offset-4 tracking-tight">failure rates above 40%</span>. These represent severe struggle points where current instructional methods or questions may be too advanced for initial comprehension.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
