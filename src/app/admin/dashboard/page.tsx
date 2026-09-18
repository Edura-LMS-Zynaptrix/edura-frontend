'use client'

import React, { useEffect, ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchAdminStats } from '@/lib/redux/slices/adminSlice'
import { fmtLKR, timeAgo } from '@/lib/utils'

const activityIcons: Record<string, { bg: string; color: string; icon: ReactNode }> = {
  student: {
    bg: 'bg-blue-100',
    color: 'text-blue-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  payment: {
    bg: 'bg-green-100',
    color: 'text-green-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  exam: {
    bg: 'bg-purple-100',
    color: 'text-purple-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
}

export default function AdminDashboard() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth)

  const { stats, statsLoading } = useAppSelector((state) => state.admin)

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const queryString = searchParams.toString()
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname
      router.push(`/login?callbackUrl=${encodeURIComponent(fullPath)}`)
    } else if (isAuthenticated && !user && !isLoading) {
      dispatch(fetchCurrentUser())
    } else if (isAuthenticated && user && user.role !== 'admin' && user.role !== 'super_admin') {
      router.push('/')
    }
  }, [isAuthenticated, isInitialized, user, dispatch, router, pathname, isLoading, searchParams])

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      dispatch(fetchAdminStats())
    }
  }, [user, dispatch])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg font-semibold">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Students',
      value: statsLoading ? '—' : (stats?.total_students ?? 0).toLocaleString(),
      sub: statsLoading ? '' : `${stats?.total_courses ?? 0} active courses`,
      bg: 'bg-blue-100',
      color: 'text-blue-600',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      label: 'Published Exams',
      value: statsLoading ? '—' : (stats?.total_exams ?? 0).toLocaleString(),
      sub: statsLoading ? '' : `${(stats?.total_exam_attempts ?? 0).toLocaleString()} attempts total`,
      bg: 'bg-purple-100',
      color: 'text-purple-600',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Revenue This Month',
      value: statsLoading ? '—' : fmtLKR(stats?.revenue_this_month ?? 0),
      sub: statsLoading ? '' : `Total: ${fmtLKR(stats?.total_revenue ?? 0)}`,
      bg: 'bg-green-100',
      color: 'text-green-600',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Pending Payments',
      value: statsLoading ? '—' : (stats?.pending_bank_slips ?? 0).toString(),
      sub: 'Bank slips awaiting review',
      bg: stats?.pending_bank_slips ? 'bg-orange-100' : 'bg-orange-50',
      color: stats?.pending_bank_slips ? 'text-orange-600' : 'text-orange-400',
      href: '/admin/payments',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Welcome */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl p-8 mb-8 shadow-lg">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back, {user.profile?.full_name?.split(' ')[0]}! 👋
          </h2>
          <p className="text-teal-100">
            Manage your platform, monitor activity, and keep everything running smoothly.
          </p>
          {!statsLoading && (stats?.pending_bank_slips ?? 0) > 0 && (
            <Link
              href="/admin/payments"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-orange-300 animate-pulse" />
              {stats!.pending_bank_slips} payment{stats!.pending_bank_slips > 1 ? 's' : ''} need review
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card) => {
            const inner = (
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 ${card.bg} rounded-lg flex items-center justify-center mb-4`}>
                  <span className={card.color}>{card.icon}</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">
                  {statsLoading ? (
                    <span className="inline-block w-20 h-7 bg-gray-200 rounded animate-pulse" />
                  ) : card.value}
                </h3>
                <p className="text-sm text-gray-600">{card.label}</p>
                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              </div>
            )
            return card.href ? (
              <Link key={card.label} href={card.href}>{inner}</Link>
            ) : (
              <div key={card.label}>{inner}</div>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { href: '/admin/streams', bg: 'bg-teal-100 group-hover:bg-teal-200', color: 'text-teal-600', label: 'Subjects & Streams', desc: 'Manage grade subjects and A/L streams', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
              { href: '/admin/courses', bg: 'bg-purple-100 group-hover:bg-purple-200', color: 'text-purple-600', label: 'Courses & Exams', desc: 'Create grade-wise courses and exams', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
              { href: '/admin/payments', bg: 'bg-green-100 group-hover:bg-green-200', color: 'text-green-600', label: 'Payments', desc: 'Verify and manage bank slips', badge: stats?.pending_bank_slips, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
              { href: '/admin/students', bg: 'bg-blue-100 group-hover:bg-blue-200', color: 'text-blue-600', label: 'Manage Students', desc: 'View and manage student accounts', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /> },
              // Edura has no separate super_admin tier — every admin account
              // is equally privileged and can manage other admin accounts.
              { href: '/admin/admins', bg: 'bg-rose-100 group-hover:bg-rose-200', color: 'text-rose-600', label: 'Manage Admins', desc: 'Create and manage admin accounts', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> },
              { href: '/admin/analytics', bg: 'bg-orange-100 group-hover:bg-orange-200', color: 'text-orange-600', label: 'Analytics', desc: 'View detailed reports and statistics', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
              { href: '/admin/rankings', bg: 'bg-yellow-100 group-hover:bg-yellow-200', color: 'text-yellow-600', label: 'Rankings', desc: 'Manage student rankings', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /> },
              { href: '/admin/messages', bg: 'bg-indigo-100 group-hover:bg-indigo-200', color: 'text-indigo-600', label: 'Messages', desc: 'Chat with students and guests', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /> },
              { href: '/admin/settings', bg: 'bg-gray-100 group-hover:bg-gray-200', color: 'text-gray-600', label: 'Settings', desc: 'System configuration and settings', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></> },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow group"
              >
                <div className={`w-12 h-12 ${item.bg} rounded-lg flex items-center justify-center mb-4 transition-colors`}>
                  <svg className={`w-6 h-6 ${item.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {item.icon}
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-1">{item.label}</h4>
                <p className="text-sm text-gray-600">{item.desc}</p>
                {!statsLoading && item.badge != null && item.badge > 0 && (
                  <span className="absolute top-4 right-4 min-w-[1.5rem] h-6 px-1.5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>

          {statsLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 rounded animate-pulse w-40" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-60" />
                  </div>
                  <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : !stats?.recent_activity?.length ? (
            <p className="text-sm text-gray-500 py-4 text-center">No recent activity yet.</p>
          ) : (
            <div className="space-y-4">
              {stats.recent_activity.map((item, i) => {
                const ic = activityIcons[item.type] ?? activityIcons.student
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-4 pb-4 ${i < stats.recent_activity.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className={`w-10 h-10 ${ic.bg} rounded-full flex items-center justify-center shrink-0`}>
                      <span className={ic.color}>{ic.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{timeAgo(item.timestamp)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

