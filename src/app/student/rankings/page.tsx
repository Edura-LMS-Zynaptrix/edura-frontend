'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchRankingExams, fetchLeaderboard, fetchExamRank } from '@/lib/redux/slices/studentDashboardSlice'

function medalColor(rank: number) {
  if (rank === 1) return 'text-yellow-500'
  if (rank === 2) return 'text-gray-400'
  if (rank === 3) return 'text-amber-600'
  return 'text-gray-400'
}

function medalIcon(rank: number) {
  if (rank <= 3) {
    return (
      <div className="flex items-center gap-1.5 font-bold">
        <svg className={`w-5 h-5 ${medalColor(rank)} flex-shrink-0`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span className={medalColor(rank)}>#{rank}</span>
      </div>
    )
  }
  return <span className="text-sm font-bold text-gray-500">#{rank}</span>
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function RankingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
      </div>
    }>
      <RankingsContent />
    </Suspense>
  )
}

function RankingsContent() {
  const dispatch = useAppDispatch()
  
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const { 
    rankingExams: exams, 
    leaderboard, 
    examRank: myRank,
    loadingRankings: loadingBoard 
  } = useAppSelector((state) => state.studentDashboard)
  const { needsProfileCompletion } = useAppSelector((state) => state.auth)

  if (needsProfileCompletion) return null

  const [activeExamId, setActiveExamId] = useState<string>('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [district, setDistrict] = useState('')
  const [loading, setLoading] = useState(true)

  const DISTRICTS = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha',
    'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala',
    'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa',
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
  ]

  const availableGroups = Array.from(
    new Set(exams.map((e) => `${e.subject} - ${e.course_title}`))
  ).sort()

  const filteredExams = exams.filter(
    (e) => !selectedGroup || `${e.subject} - ${e.course_title}` === selectedGroup
  )

  // Load exams on mount
  useEffect(() => {
    const initExams = async () => {
      if (exams.length === 0) {
        await dispatch(fetchRankingExams())
      }
      setLoading(false)
    }
    initExams()
  }, [dispatch, exams.length])

  // Clear exam selection if group changes
  useEffect(() => {
    setActiveExamId('')
  }, [selectedGroup])

  // Fetch Leaderboard Network effect
  useEffect(() => {
    if (!activeExamId) return
    dispatch(fetchLeaderboard({ exam_id: activeExamId, district, limit: 100 }))
  }, [dispatch, activeExamId, district])

  // Fetch Personal Rank effect
  useEffect(() => {
    if (!activeExamId || !isAuthenticated) return
    dispatch(fetchExamRank(activeExamId))
  }, [dispatch, activeExamId, isAuthenticated])

  const handleExam = (id: string) => {
    setActiveExamId(id)
  }

  const activeExamDetails = exams.find(e => e.exam_id === activeExamId)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading rankings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Rankings</h1>
            <p className="text-gray-500 mt-1 text-sm sm:text-base">
              Top rankers for each exam based on score and time (First Attempt).
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 shrink-0"
          >
            ← Dashboard
          </Link>
        </div>

        {exams.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 sm:p-16 text-center shadow-sm">
            <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No rankings yet</h2>
            <p className="text-gray-500 mb-6">Rankings appear once students complete exams</p>
            <Link href="/student/courses" className="px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors">
              Browse Courses
            </Link>
          </div>
        ) : (
          <>
            {/* Filter Selectors */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm flex flex-wrap gap-3 max-w-4xl">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white sm:min-w-[200px]"
              >
                <option value="">All Courses</option>
                {availableGroups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>

              <select
                value={activeExamId}
                onChange={(e) => handleExam(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white sm:min-w-[250px]"
              >
                <option value="">-- Select an Exam --</option>
                {filteredExams.map((ex) => (
                  <option key={ex.exam_id} value={ex.exam_id}>
                    {ex.exam_title}
                  </option>
                ))}
              </select>

              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="">All Districts</option>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>

              {(selectedGroup || activeExamId || district) && (
                <button
                  onClick={() => { setSelectedGroup(''); handleExam(''); setDistrict('') }}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear filters
                </button>
              )}
            </div>

            {/* My Rank Banner (only when logged in and found) */}
            {isAuthenticated && myRank && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                    #{myRank.overall_rank}
                  </div>
                  <div>
                    <p className="font-semibold text-teal-900">Your ranking for <span className="text-teal-700">{activeExamDetails?.exam_title}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-teal-600 bg-teal-100 px-3 py-1 rounded-full border border-teal-200">
                    Island Rank: #{myRank.overall_rank}
                  </span>
                  <span className="text-sm font-medium text-teal-600 bg-teal-100 px-3 py-1 rounded-full border border-teal-200">
                    District Rank: #{myRank.district_rank || '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Leaderboard Section */}
            <div className="mt-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                  {activeExamDetails?.exam_title || 'Exam'} <span className="text-teal-600 block sm:inline">Top 100 Rankers</span>
                </h2>
                {loadingBoard && (
                   <span className="text-sm font-medium text-teal-600 bg-teal-50 px-3 py-1 rounded-full animate-pulse self-start sm:self-auto">Updating live...</span>
                )}
              </div>

              {!activeExamId ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center shadow-sm">
                  <div className="text-5xl mb-4">📋</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Select an Exam</h3>
                  <p className="text-gray-500">Choose an exam from the dropdown above to view the elite top 100 rankers.</p>
                </div>
              ) : leaderboard.length === 0 && !loadingBoard ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center shadow-sm">
                  <div className="text-5xl mb-4">🏆</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No Attempts Yet</h3>
                  <p className="text-gray-500">Be the first to take this exam and claim the #1 spot!</p>
                </div>
              ) : (
                <>
                  {/* Top 3 Podium (Desktop) / Cards (Mobile) */}
                  {!loadingBoard && leaderboard.length > 0 && (
                    <div className="flex flex-col md:grid md:grid-cols-3 gap-6 md:gap-8 mb-12 mt-20 md:mt-24 items-end max-w-4xl mx-auto">
                      {/* Rank 2 (Left) */}
                      {leaderboard[1] && (
                        <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl p-5 border border-gray-200 shadow-md relative overflow-hidden transform transition hover:-translate-y-1 md:order-1 order-2 w-full">
                          <div className="absolute top-0 right-0 w-20 h-20 bg-gray-200 rounded-bl-full opacity-20 -mr-4 -mt-4"></div>
                          <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3 border-[3px] border-gray-300 shadow-inner relative">
                              <span className="text-xl font-bold text-gray-400">#2</span>
                              {leaderboard[1].is_current_user && (
                                <span className="absolute -bottom-2 bg-teal-600 text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border border-white">You</span>
                              )}
                            </div>
                            <h3 className="font-bold text-base text-gray-900 w-full line-clamp-2 min-h-[48px] flex items-center justify-center leading-tight px-2">{leaderboard[1].full_name}</h3>
                            <p className="text-[11px] text-gray-500 truncate w-full mb-3 mt-1 px-2">{leaderboard[1].school}</p>
                            <div className="bg-gray-100 rounded-lg py-2 px-3 w-full">
                              <p className="text-xl font-black text-gray-700">{leaderboard[1].score}%</p>
                              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">{formatTime(leaderboard[1].time_taken_seconds)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rank 1 (Center) */}
                      {leaderboard[0] && (
                        <div className="bg-gradient-to-b from-yellow-50 via-white to-white rounded-2xl p-6 md:p-7 border-2 border-yellow-300 shadow-xl relative overflow-hidden transform transition hover:-translate-y-2 md:order-2 order-1 z-10 w-full md:w-[105%] md:-ml-[2.5%] md:-mt-10 mt-4">
                          <div className="absolute top-0 right-0 w-28 h-28 bg-yellow-300 rounded-bl-full opacity-20 -mr-6 -mt-6"></div>
                          <div className="absolute -top-3 left-1/2 min-w-[24px] transform -translate-x-1/2 text-3xl">👑</div>
                          <div className="flex flex-col items-center text-center mt-3 pt-1">
                            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4 border-4 border-yellow-400 shadow-inner relative z-20">
                              <span className="text-4xl font-black text-yellow-600">#1</span>
                              {leaderboard[0].is_current_user && (
                                <span className="absolute -bottom-2 bg-teal-600 text-white text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border border-white">You</span>
                              )}
                            </div>
                            <h3 className="font-black text-lg sm:text-xl text-gray-900 w-full line-clamp-2 min-h-[56px] flex items-center justify-center leading-tight px-2">{leaderboard[0].full_name}</h3>
                            <p className="text-[11px] sm:text-xs font-medium text-amber-700 xl:truncate w-full mb-4 mt-1 px-2">{leaderboard[0].school}</p>
                            <div className="bg-yellow-100/50 border border-yellow-200 rounded-xl py-3 px-5 w-full shadow-sm">
                              <p className="text-3xl font-black text-yellow-700">{leaderboard[0].score}%</p>
                              <p className="text-[10px] text-yellow-600/80 uppercase font-black tracking-widest mt-0.5">{formatTime(leaderboard[0].time_taken_seconds)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rank 3 (Right) */}
                      {leaderboard[2] && (
                        <div className="bg-gradient-to-b from-amber-50 to-white rounded-2xl p-5 border border-amber-200 shadow-md relative overflow-hidden transform transition hover:-translate-y-1 md:order-3 order-3 w-full">
                          <div className="absolute top-0 left-0 w-20 h-20 bg-amber-200 rounded-br-full opacity-20 -ml-4 -mt-4"></div>
                          <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-3 border-[3px] border-amber-400/50 shadow-inner relative">
                              <span className="text-xl font-bold text-amber-600">#3</span>
                              {leaderboard[2].is_current_user && (
                                <span className="absolute -bottom-2 bg-teal-600 text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border border-white">You</span>
                              )}
                            </div>
                            <h3 className="font-bold text-base text-gray-900 w-full line-clamp-2 min-h-[48px] flex items-center justify-center leading-tight px-2">{leaderboard[2].full_name}</h3>
                            <p className="text-[11px] text-gray-500 truncate w-full mb-3 mt-1 px-2">{leaderboard[2].school}</p>
                            <div className="bg-amber-50 rounded-lg py-2 px-3 w-full border border-amber-100">
                              <p className="text-xl font-black text-amber-700">{leaderboard[2].score}%</p>
                              <p className="text-[9px] text-amber-600/70 uppercase font-bold tracking-wider mt-0.5">{formatTime(leaderboard[2].time_taken_seconds)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rest of the Table (Ranks 4-100) */}
                  {(loadingBoard || leaderboard.length > 3) && (
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50/80 border-b border-gray-200">
                            <tr>
                              <th className="px-4 sm:px-6 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest w-20">Rank</th>
                              <th className="px-4 sm:px-6 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Student</th>
                              <th className="px-4 sm:px-4 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">School</th>
                              <th className="px-4 sm:px-4 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest hidden sm:table-cell">District</th>
                              <th className="px-4 py-4 text-center text-xs font-black text-gray-400 uppercase tracking-widest hidden lg:table-cell">Grade</th>
                              <th className="px-4 py-4 text-center text-xs font-black text-gray-400 uppercase tracking-widest">Score</th>
                              <th className="px-4 sm:px-6 py-4 text-right text-xs font-black text-gray-400 uppercase tracking-widest">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {loadingBoard ? (
                              [...Array(10)].map((_, i) => (
                                <tr key={i}>
                                  {[...Array(7)].map((_, j) => (
                                    <td key={j} className={`px-4 py-4 ${j === 2 ? 'hidden md:table-cell' : j === 3 ? 'hidden sm:table-cell' : j === 4 ? 'hidden lg:table-cell' : ''}`}>
                                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                                    </td>
                                  ))}
                                </tr>
                              ))
                            ) : (
                              leaderboard.slice(3).map((entry, index) => (
                                <tr
                                  key={`${entry.rank}-${index}`}
                                  className={`transition-colors hover:bg-gray-50/70 ${
                                    entry.is_current_user
                                      ? 'bg-teal-50 border-l-4 border-teal-500'
                                      : ''
                                  }`}
                                >
                                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                    <span className={`text-sm font-bold ${entry.is_current_user ? 'text-teal-700' : 'text-gray-400'}`}>#{entry.rank}</span>
                                  </td>
                                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                      {entry.is_current_user && (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-teal-600 text-white shadow-sm">
                                          {entry.full_name.trim().charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <div>
                                        <p className={`font-semibold ${entry.is_current_user ? 'text-teal-900' : 'text-gray-900'}`}>
                                          {entry.full_name}
                                          {entry.is_current_user && (
                                            <span className="ml-2 text-[10px] bg-teal-100 border border-teal-200 text-teal-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">You</span>
                                          )}
                                        </p>
                                        <p className="text-xs text-gray-500 md:hidden mt-0.5">{entry.school}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-gray-500 text-sm hidden md:table-cell max-w-[200px] truncate">{entry.school}</td>
                                  <td className="px-4 py-4 text-gray-500 text-sm hidden sm:table-cell whitespace-nowrap">
                                    <div className="flex flex-col">
                                      <span>{entry.district}</span>
                                      <span className="text-[10px] text-gray-400 uppercase font-semibold">Dist Rank: #{entry.district_rank}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center hidden lg:table-cell">
                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-bold">
                                      G{entry.grade}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={`font-black tracking-tight ${
                                      entry.score >= 75 ? 'text-green-600' :
                                      entry.score >= 50 ? 'text-yellow-600' : 'text-gray-600'
                                    }`}>
                                      {entry.score}%
                                    </span>
                                  </td>
                                  <td className="px-4 sm:px-6 py-4 text-right text-gray-500 text-sm whitespace-nowrap font-medium">
                                    {formatTime(entry.time_taken_seconds)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
