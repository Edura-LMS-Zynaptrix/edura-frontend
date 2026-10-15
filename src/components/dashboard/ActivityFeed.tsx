'use client'

import React from 'react'
import Link from 'next/link'
import * as LucideIcons from 'lucide-react'

interface ActivityFeedProps {
  attempts: any[]
  loading: boolean
  user: any
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ attempts, loading, user }) => {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-2">Welcome back, {user?.profile?.full_name?.split(' ')[0] || 'Student'}! 👋</h1>
          <p className="text-teal-50 font-medium">You're doing great! Keep up the good work and ace those exams.</p>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10 flex gap-4 rotate-12 translate-x-12 -translate-y-4">
          <LucideIcons.BookOpen size={120} />
          <LucideIcons.Trophy size={80} />
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <LucideIcons.Target size={18} />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Average Score</span>
          </div>
          <div className="text-2xl font-black text-gray-900">
            {attempts.length > 0 
              ? `${Math.round(attempts.reduce((acc, a) => acc + (a.marks_obtained / (a.total_questions || 1)) * 100, 0) / attempts.length)}%`
              : '0%'}
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <LucideIcons.Zap size={18} />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Exam Streak</span>
          </div>
          <div className="text-2xl font-black text-gray-900">12 Days</div>
        </div>
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
              <LucideIcons.PenTool size={18} />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Attempts</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{attempts.length}</div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-bold text-gray-900">Recent Activity</h3>
          <Link href="/student/my-results" className="text-sm font-semibold text-teal-600 hover:text-teal-700">
            View All
          </Link>
        </div>
        
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <LucideIcons.Loader2 className="animate-spin mx-auto mb-2 text-teal-600" size={32} />
              <p className="font-medium">Loading your activity...</p>
            </div>
          ) : attempts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-gray-200">
                <LucideIcons.Ghost className="text-gray-300" size={32} />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">No activity yet</h4>
              <p className="text-sm text-gray-500 mb-6">Start your first exam to see your progress here!</p>
              <Link href="/student/my-courses" className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all active:scale-95 shadow-lg shadow-teal-500/20">
                Browse Courses <LucideIcons.ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            attempts.map((attempt) => (
              <div key={attempt.attempt_id} className="p-6 hover:bg-gray-50 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    attempt.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <LucideIcons.CheckCircle2 size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                       <h4 className="font-bold text-gray-900 truncate group-hover:text-teal-600 transition-colors">
                        Attempted: {attempt.exam_title}
                      </h4>
                      <span className="text-[11px] font-black uppercase text-gray-400 shrink-0">
                        {new Date(attempt.started_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3 truncate">{attempt.course_title} • {attempt.subject}</p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 bg-white border border-gray-100 px-3 py-1 rounded-full shadow-sm">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Score</span>
                        <span className="text-sm font-black text-teal-600">
                          {Math.round((attempt.marks_obtained / (attempt.total_questions || 1)) * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white border border-gray-100 px-3 py-1 rounded-full shadow-sm">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Rank</span>
                        <span className="text-sm font-black text-blue-600">#{attempt.overall_rank || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ActivityFeed
