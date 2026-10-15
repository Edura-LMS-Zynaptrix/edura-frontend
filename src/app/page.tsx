'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchPlatformStats, fetchRankingExams, fetchLeaderboard } from '@/lib/redux/slices/studentDashboardSlice'
import { fetchPublicStreams } from '@/lib/redux/slices/adminSlice'
import type { TopCourse, LeaderboardEntry } from '@/lib/api/student'

// ---------- Animated counter hook ----------
function useCountUp(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start || target === 0) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return value
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k'
  return n.toString()
}

const subjectColors: Record<string, string> = {
  Mathematics: 'bg-blue-100 text-blue-700',
  Science: 'bg-green-100 text-green-700',
  English: 'bg-purple-100 text-purple-700',
  History: 'bg-yellow-100 text-yellow-700',
  'Combined Mathematics': 'bg-indigo-100 text-indigo-700',
  Physics: 'bg-cyan-100 text-cyan-700',
  Chemistry: 'bg-pink-100 text-pink-700',
  Biology: 'bg-emerald-100 text-emerald-700',
  ICT: 'bg-orange-100 text-orange-700',
}
function subjectColor(s: string) {
  return subjectColors[s] ?? 'bg-teal-100 text-teal-700'
}

const medals = ['🥇', '🥈', '🥉']

export default function Home() {
  const dispatch = useAppDispatch()
  
  const stats = useAppSelector((state) => state.studentDashboard.platformStats)
  const topPerformers = useAppSelector((state) => state.studentDashboard.leaderboard)
  const rankingExams = useAppSelector((state) => state.studentDashboard.rankingExams)
  const { streams } = useAppSelector((state) => state.admin)

  const [statsVisible, setStatsVisible] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && (user?.role === 'admin' || user?.role === 'super_admin')) {
      router.push('/admin/dashboard')
    }
  }, [isAuthenticated, user, router])

  useEffect(() => {
    if (!stats) {
      dispatch(fetchPlatformStats())
    }
    if (rankingExams.length === 0) {
      dispatch(fetchRankingExams())
    }
    if (streams.length === 0) {
      dispatch(fetchPublicStreams())
    }
  }, [dispatch, stats, rankingExams.length, streams.length])

  useEffect(() => {
    if (rankingExams.length > 0 && topPerformers.length === 0) {
      dispatch(fetchLeaderboard({ exam_id: rankingExams[0].exam_id, limit: 3 }))
    }
  }, [dispatch, rankingExams, topPerformers.length])

  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.4 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const studentsCount  = useCountUp(stats?.total_students  ?? 0, 2000, statsVisible)
  const coursesCount   = useCountUp(stats?.total_courses   ?? 0, 1400, statsVisible)
  const examsCount     = useCountUp(stats?.total_exams     ?? 0, 1600, statsVisible)
  const attemptsCount  = useCountUp(stats?.total_attempts  ?? 0, 2200, statsVisible)

  return (
    <main className="min-h-screen bg-white overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-[calc(100vh-4rem)] flex items-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 overflow-hidden w-full">
        <div className="absolute -top-20 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 border border-white/25 text-white/90 rounded-full text-sm font-semibold mb-6">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Sri Lanka&apos;s #1 Exam Prep Platform
              </span>
              <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
                Master Your<br />
                <span className="text-cyan-300">O/L &amp; A/L</span><br />
                Exams
              </h1>
              <p className="text-lg text-teal-100 mb-8 leading-relaxed max-w-lg">
                Practice with real MCQ papers, compete in island-wide rankings, and track your progress with smart analytics. Your path to academic excellence starts here.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/register" className="px-8 py-4 bg-white text-teal-700 rounded-xl font-bold hover:bg-gray-50 transition-colors text-center shadow-lg shadow-black/20">
                  Get Started Free
                </Link>
                <Link href="/student/courses" className="px-8 py-4 bg-white/10 border border-white/30 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors text-center">
                  Browse Courses
                </Link>
              </div>
            </div>
            {/* Modern CSS Visual Effect */}
            <div className="hidden lg:flex relative z-10 w-full max-w-lg ml-auto h-[400px] items-center justify-center">
              
              {/* Glowing aura */}
              <div className="absolute inset-0 bg-teal-400/20 blur-[100px] rounded-full animate-pulse" />

              {/* Central Core */}
              <div className="relative w-32 h-32 bg-gradient-to-br from-white to-teal-50 rounded-full shadow-[0_0_40px_rgba(20,184,166,0.4)] flex items-center justify-center z-20 animate-[bounce_4s_infinite]">
                <div className="w-20 h-20 bg-gradient-to-tr from-teal-500 to-cyan-400 rounded-full shadow-inner flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 drop-shadow-md">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                </div>
              </div>

              {/* Orbit 1 */}
              <div className="absolute w-[260px] h-[260px] border border-white/20 rounded-full animate-[spin_12s_linear_infinite] z-10">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl flex items-center justify-center border border-white/20 animate-[spin_12s_linear_infinite_reverse]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-lg flex items-center justify-center border border-white/20 animate-[spin_12s_linear_infinite_reverse]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
              </div>

              {/* Orbit 2 */}
              <div className="absolute w-[380px] h-[380px] border border-white/10 rounded-full animate-[spin_24s_linear_infinite_reverse] z-0">
                <div className="absolute top-1/2 -right-8 -translate-y-1/2 w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/30 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] flex items-center justify-center animate-[spin_24s_linear_infinite]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                </div>
                <div className="absolute top-1/4 -left-6 w-12 h-12 bg-gradient-to-br from-fuchsia-500 to-pink-600 rounded-full shadow-lg border-2 border-white/20 flex items-center justify-center animate-[spin_24s_linear_infinite]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="6"/>
                    <circle cx="12" cy="12" r="2"/>
                  </svg>
                </div>
              </div>

              {/* Floating tech nodes */}
              <div className="absolute top-1/4 right-1/4 w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_15px_#22d3ee] animate-ping" />
              <div className="absolute bottom-1/3 left-1/4 w-2 h-2 bg-pink-400 rounded-full shadow-[0_0_10px_#f472b6] animate-pulse" />
              <div className="absolute top-10 right-10 w-24 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50 -rotate-45" />
              <div className="absolute bottom-20 left-10 w-32 h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-30 rotate-12" />
            </div>
          </div>
        </div>
      </section>

      {/* Live Analytics Stats */}
      <section ref={statsRef} className="py-14 bg-gray-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-8">Platform Statistics — Updated in Real Time</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12">
            {[
              { label: 'Registered Students', value: studentsCount, suffix: '+', icon: '👩‍🎓', color: 'text-teal-600' },
              { label: 'Active Courses', value: coursesCount, suffix: '', icon: '📚', color: 'text-blue-600' },
              { label: 'Practice Exams', value: examsCount, suffix: '+', icon: '📝', color: 'text-purple-600' },
              { label: 'Exam Attempts', value: attemptsCount, suffix: '+', icon: '🏆', color: 'text-orange-500' },
            ].map(({ label, value, suffix, icon, color }) => (
              <div key={label} className="text-center">
                <div className="text-3xl mb-2">{icon}</div>
                <div className={`text-4xl font-extrabold ${color} mb-1`}>{fmt(value)}{suffix}</div>
                <div className="text-sm text-gray-500 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-sm font-semibold mb-3">Simple Process</span>
            <h2 className="text-4xl font-bold text-gray-900">How Edura Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-teal-200 via-blue-200 to-purple-200 z-0" />
            {[
              { step: '01', title: 'Create Account', desc: 'Sign up in seconds with your school details', icon: '✍️', bg: 'bg-teal-50 border-teal-200' },
              { step: '02', title: 'Enrol in Courses', desc: 'Choose from our curated O/L and A/L course packages', icon: '📘', bg: 'bg-blue-50 border-blue-200' },
              { step: '03', title: 'Practice & Compete', desc: 'Attempt timed MCQ papers and rank island-wide', icon: '⚡', bg: 'bg-purple-50 border-purple-200' },
              { step: '04', title: 'Track Progress', desc: 'View detailed analytics, scores, and your rankings', icon: '📊', bg: 'bg-orange-50 border-orange-200' },
            ].map(({ step, title, desc, icon, bg }) => (
              <div key={step} className={`relative z-10 rounded-2xl border ${bg} p-6 text-center`}>
                <div className="text-3xl mb-3">{icon}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Step {step}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Courses — real data */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold mb-3">Real Courses</span>
              <h2 className="text-4xl font-bold text-gray-900">Popular Courses</h2>
              <p className="text-gray-500 mt-2">Used by top-performing students across Sri Lanka</p>
            </div>
            <Link href="/student/courses" className="shrink-0 text-teal-600 font-semibold hover:text-teal-700 transition-colors flex items-center gap-1">
              View all courses
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          {stats?.top_courses && stats.top_courses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.top_courses.map((course: TopCourse) => (
                <Link key={course.id} href={`/student/courses/${course.id}`}
                  className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1">
                  <div className="relative h-36 bg-gradient-to-br from-teal-100 to-blue-100">
                    {course.image_url ? (
                      <Image src={course.image_url} alt={course.title} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-30">📘</div>
                    )}
                    <div className="absolute top-2 right-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${subjectColor(course.subject)}`}>{course.subject}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Grade {course.grade}</span>
                      {course.stream_ids && course.stream_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {course.stream_ids.slice(0, 2).map(sid => (
                            <span key={sid} className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-[10px] font-medium border border-teal-100">
                              {streams.find(s => s.id === sid)?.name || 'Stream'}
                            </span>
                          ))}
                          {course.stream_ids.length > 2 && <span className="text-[10px] text-gray-400">+{course.stream_ids.length - 2}</span>}
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight mb-3 group-hover:text-teal-600 transition-colors">{course.title}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-teal-600 font-bold text-sm">{course.price === 0 ? 'Free' : `LKR ${course.price.toLocaleString()}`}</span>
                      <span className="text-xs text-teal-600 font-semibold group-hover:underline">Enrol →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
                  <div className="h-36 bg-gray-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-sm font-semibold mb-3">Why Edura</span>
            <h2 className="text-4xl font-bold text-gray-900">Everything You Need to Excel</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">Comprehensive tools built specifically for Sri Lankan O/L and A/L students</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { color: 'bg-teal-100 text-teal-600', title: 'Structured Courses', desc: 'Grade 6–13 courses covering all primary and secondary subjects with organised exam collections.', path: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
              { color: 'bg-blue-100 text-blue-600', title: 'Live Rankings', desc: 'Compete island-wide and district-wide. See your rank update after every exam.', path: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
              { color: 'bg-orange-100 text-orange-600', title: 'Timed Practice', desc: 'Simulate real exam pressure with strict countdowns. Builds speed and accuracy.', path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              { color: 'bg-green-100 text-green-600', title: 'Detailed Solutions', desc: 'Every question has a full explanation. Learn from mistakes immediately after submission.', path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
              { color: 'bg-purple-100 text-purple-600', title: 'Score Analytics', desc: 'Track your progress over time. Know your strongest and weakest areas instantly.', path: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { color: 'bg-pink-100 text-pink-600', title: 'Instant Results', desc: 'Automatic grading the moment you submit. No waiting — see your score right away.', path: 'M13 10V3L4 14h7v7l9-11h-7z' },
            ].map(({ color, title, desc, path }) => (
              <div key={title} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all hover:-translate-y-0.5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Performers — real leaderboard data */}
      {topPerformers.length > 0 && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 bg-yellow-400/20 text-yellow-300 rounded-full text-sm font-semibold mb-3">Live Leaderboard</span>
              <h2 className="text-4xl font-bold text-white">Top Performers</h2>
              <p className="text-gray-400 mt-2">Real rankings from students on the platform right now</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {topPerformers.map((p: LeaderboardEntry, i: number) => (
                <div key={i} className={`relative rounded-2xl p-6 text-center border ${
                  i === 0 ? 'bg-yellow-400/10 border-yellow-400/30' :
                  i === 1 ? 'bg-gray-300/10 border-gray-400/30' :
                  'bg-orange-400/10 border-orange-400/30'}`}>
                  {i === 0 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-gray-900 text-xs font-bold px-3 py-0.5 rounded-full">#1 Ranked</div>
                  )}
                  <div className="text-4xl mb-3">{medals[i]}</div>
                  <div className="font-bold text-white text-lg mb-1">{p.full_name}</div>
                  <div className="text-gray-400 text-xs mb-3">{p.school} · {p.district}</div>
                  <div className={`text-2xl font-extrabold mb-1 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400'}`}>{p.score}%</div>
                  <div className="text-gray-500 text-xs">Grade {p.grade}</div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/student/rankings" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/20 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors">
                View Full Rankings
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/5 to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Ready to Achieve Your Best?</h2>
          <p className="text-xl text-teal-100 mb-10">
            Join{' '}
            {stats ? (
              <span className="font-bold text-white">{stats.total_students.toLocaleString()}+ students</span>
            ) : 'thousands of students'}{' '}
            already improving their exam performance with Edura.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="px-10 py-4 bg-white text-teal-700 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-xl shadow-black/20">
              Create Free Account
            </Link>
            <Link href="/login" className="px-10 py-4 bg-white/10 border border-white/30 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </section>


    </main>
  )
}
