'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchAdminRankings } from '@/lib/redux/slices/adminSlice'

const GRADES = [5, 6, 7, 8, 9, 10, 11, 12, 13]

export default function AdminRankingsPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((s) => s.auth)
  const { rankings: rankingsData, rankingsLoading: loading, error } = useAppSelector((s) => s.admin)

  const rankings = rankingsData?.rankings ?? []
  const exams = rankingsData?.exams ?? []

  // Extract unique subjects & courses for the first filter
  const availableGroups = Array.from(
    new Set(exams.map((e) => `${e.subject} - ${e.course_title}`))
  ).sort()

  const [selectedGroup, setSelectedGroup] = useState('')
  const [examId, setExamId] = useState('')
  const [district, setDistrict] = useState('')

  // Also extract unique districts from the current students list if we wanted a dynamic list,
  // but for simplicity we'll just use a static list or text input.
  const DISTRICTS = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha',
    'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala',
    'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa',
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
  ]

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'super_admin') router.push('/')
  }, [user, router])

  // Clear exam selection if group changes
  useEffect(() => {
    setExamId('')
  }, [selectedGroup])

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) return
    const params: Record<string, any> = { limit: 100 }
    
    // Only fetch rankings if an exam is selected
    if (examId) {
      params.exam_id = examId
      if (district) params.district = district
      dispatch(fetchAdminRankings(params))
    } else if (exams.length === 0) {
      // First load: just fetch the available exams (exam_id is optional and will return empty rankings but full exam list)
      dispatch(fetchAdminRankings(params))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, examId, district])

  const filteredExams = exams.filter(
    (e) => !selectedGroup || `${e.subject} - ${e.course_title}` === selectedGroup
  )

  const medal = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Rankings</h1>
          <p className="text-sm text-gray-500 mt-1">Student performance leaderboard by subject</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm flex flex-wrap gap-3">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white min-w-[200px]"
          >
            <option value="">All Courses</option>
            {availableGroups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white min-w-[250px]"
          >
            <option value="">-- Select an Exam --</option>
            {filteredExams.map((e) => (
              <option key={e.exam_id} value={e.exam_id}>{e.exam_title}</option>
            ))}
          </select>

          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="">All Districts</option>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          {(selectedGroup || examId || district) && (
            <button
              onClick={() => { setSelectedGroup(''); setExamId(''); setDistrict('') }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </button>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-16">Island Rank</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-16 hidden md:table-cell">District Rank</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">District</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Score %</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Marks</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Time</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !examId ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-gray-400">
                      <div className="text-4xl mb-2">📋</div>
                      <p>Select an exam from the dropdown above to view its rankings.</p>
                    </td>
                  </tr>
                ) : rankings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-gray-400">
                      <div className="text-4xl mb-2">🏆</div>
                      <p>No attempts found for this exam.</p>
                    </td>
                  </tr>
                ) : (
                  rankings.map((row) => (
                    <tr key={`${row.user_id}`} className={`hover:bg-gray-50 transition-colors ${row.island_rank <= 3 ? 'bg-yellow-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {medal(row.island_rank) ? (
                            <span className="text-lg">{medal(row.island_rank)}</span>
                          ) : (
                            <span className="text-sm font-semibold text-gray-500">#{row.island_rank}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm font-semibold text-gray-500 flex items-center gap-1">
                          {medal(row.district_rank)} #{row.district_rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{row.full_name}</p>
                          <p className="text-xs text-gray-400 hidden sm:block truncate max-w-[200px]">
                            {row.school} &bull; Grade {row.grade}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{row.district}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${
                          row.score_pct >= 75 ? 'text-green-600' :
                          row.score_pct >= 50 ? 'text-yellow-600' : 'text-red-500'
                        }`}>
                          {row.score_pct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {row.total_marks}/{row.total_questions}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 hidden sm:table-cell">
                        {Math.floor(row.time_taken_seconds / 60)}m {row.time_taken_seconds % 60}s
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 hidden md:table-cell">{row.attempt_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
