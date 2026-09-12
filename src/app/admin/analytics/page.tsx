'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchAdminAnalytics, fetchAdminStats } from '@/lib/redux/slices/adminSlice'
import { fmtLKR } from '@/lib/utils'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function BarChart({
  data,
  valueKey,
  labelKey,
  color = 'bg-teal-500',
  formatValue,
}: {
  data: Record<string, any>[]
  valueKey: string
  labelKey: string
  color?: string
  formatValue?: (v: number) => string
}) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1)
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div className="relative w-full">
            <div
              className={`w-full ${color} rounded-t transition-all`}
              style={{ height: `${Math.max((d[valueKey] / max) * 112, 4)}px` }}
            />
            {/* Tooltip */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
              {formatValue ? formatValue(d[valueKey]) : d[valueKey]}
            </div>
          </div>
          <span className="text-xs text-gray-500 truncate w-full text-center">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  )
}

function HorizontalBar({ label, value, max, color = 'bg-teal-500', formatValue }: {
  label: string
  value: number
  max: number
  color?: string
  formatValue?: (v: number) => string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 w-32 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-gray-900 w-12 text-right shrink-0">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
  )
}


export default function AdminAnalyticsPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((s) => s.auth)
  const { analytics, analyticsLoading: loading, stats, error } = useAppSelector((s) => s.admin)

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'super_admin') router.push('/')
  }, [user, router])

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) return
    dispatch(fetchAdminAnalytics())
    dispatch(fetchAdminStats())
  }, [user, dispatch])

  // Prepare monthly revenue chart data (last 6 months)
  const revenueChartData = analytics?.revenue_by_month.slice(-6).map((r) => ({
    label: MONTH_NAMES[r.month - 1],
    revenue: r.revenue,
  })) ?? []

  const attemptChartData = analytics?.attempts_by_month.slice(-6).map((r) => ({
    label: MONTH_NAMES[r.month - 1],
    count: r.count,
  })) ?? []

  const maxEnroll = Math.max(...(analytics?.enrollments_by_subject.map((e) => e.count) ?? [1]), 1)
  const maxDistrict = Math.max(...(analytics?.students_by_district.map((d) => d.count) ?? [1]), 1)

  const summaryCards = [
    {
      label: 'Total Students',
      value: loading ? '—' : (stats?.total_students ?? 0).toLocaleString(),
      sub: 'Registered students',
      bg: 'bg-blue-50', color: 'text-blue-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
    },
    {
      label: 'Total Revenue',
      value: loading ? '—' : fmtLKR(stats?.total_revenue ?? 0),
      sub: `This month: ${fmtLKR(stats?.revenue_this_month ?? 0)}`,
      bg: 'bg-green-50', color: 'text-green-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    },
    {
      label: 'Published Exams',
      value: loading ? '—' : (stats?.total_exams ?? 0).toLocaleString(),
      sub: `${(stats?.total_exam_attempts ?? 0).toLocaleString()} total attempts`,
      bg: 'bg-purple-50', color: 'text-purple-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    },
    {
      label: 'Active Courses',
      value: loading ? '—' : (stats?.total_courses ?? 0).toLocaleString(),
      sub: 'Live courses on platform',
      bg: 'bg-orange-50', color: 'text-orange-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide performance metrics</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {summaryCards.map((c) => (
            <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center mb-3`}>
                <svg className={`w-5 h-5 ${c.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {c.icon}
                </svg>
              </div>
              <p className="text-xl font-bold text-gray-900">{c.value}</p>
              <p className="text-sm text-gray-600">{c.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Revenue by month */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue by Month</h3>
            {loading ? (
              <div className="h-32 bg-gray-50 rounded animate-pulse" />
            ) : revenueChartData.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No revenue data yet</p>
            ) : (
              <BarChart data={revenueChartData} valueKey="revenue" labelKey="label" color="bg-green-500" formatValue={fmtLKR} />
            )}
          </div>

          {/* Exam attempts by month */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Exam Attempts by Month</h3>
            {loading ? (
              <div className="h-32 bg-gray-50 rounded animate-pulse" />
            ) : attemptChartData.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No attempt data yet</p>
            ) : (
              <BarChart data={attemptChartData} valueKey="count" labelKey="label" color="bg-blue-500" />
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Students by grade */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Students by Grade</h3>
            {loading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : !analytics?.students_by_grade.length ? (
              <p className="text-sm text-gray-400 py-4 text-center">No data yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.students_by_grade.map((r) => (
                  <HorizontalBar
                    key={r.grade}
                    label={`Grade ${r.grade}`}
                    value={r.count}
                    max={Math.max(...analytics.students_by_grade.map((g) => g.count), 1)}
                    color="bg-teal-500"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Enrollments by subject */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Enrollments by Subject</h3>
            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : !analytics?.enrollments_by_subject.length ? (
              <p className="text-sm text-gray-400 py-4 text-center">No enrollment data yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.enrollments_by_subject.map((r) => (
                  <HorizontalBar
                    key={r.subject}
                    label={r.subject}
                    value={r.count}
                    max={maxEnroll}
                    color="bg-purple-500"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Charts Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top exams */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Top Exams by Attempts</h3>
            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : !analytics?.top_exams.length ? (
              <p className="text-sm text-gray-400 py-4 text-center">No exam data yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.top_exams.map((exam, i) => (
                  <div key={exam.exam_id} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-200 w-6 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{exam.title}</p>
                      <p className="text-xs text-gray-500">Grade {exam.grade} · {exam.subject}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{exam.attempt_count} <span className="text-xs font-normal text-gray-400">attempts</span></p>
                      <p className="text-xs text-teal-600">{exam.avg_score}% avg</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Students by district */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Top Districts</h3>
            {loading ? (
              <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : !analytics?.students_by_district.length ? (
              <p className="text-sm text-gray-400 py-4 text-center">No data yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.students_by_district.map((r) => (
                  <HorizontalBar
                    key={r.district}
                    label={r.district}
                    value={r.count}
                    max={maxDistrict}
                    color="bg-orange-400"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
