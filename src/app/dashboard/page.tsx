'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchMyEnrollments, fetchMyAttempts } from '@/lib/redux/slices/studentDashboardSlice'
import { fetchReferralSummary } from '@/lib/redux/slices/referralSlice'
import { fetchBadgeDashboard } from '@/lib/redux/slices/badgesSlice'

// New Components
import Sidebar from '@/components/dashboard/Sidebar'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import AchievementPanel from '@/components/dashboard/AchievementPanel'

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  
  const { user, isAuthenticated, isInitialized } = useAppSelector((state) => state.auth)
  const { 
    enrollments, 
    attempts, 
    loadingAttempts 
  } = useAppSelector((state) => state.studentDashboard)
  const { earnedBadges, isLoading: loadingBadges } = useAppSelector((state) => state.badges)
  const { summary: referralSummary } = useAppSelector((state) => state.referral)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const queryString = searchParams.toString()
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname
      router.push(`/login?callbackUrl=${encodeURIComponent(fullPath)}`)
    } else if (isAuthenticated && !user) {
      dispatch(fetchCurrentUser())
    }
  }, [isInitialized, isAuthenticated, user, dispatch, router, pathname, searchParams])

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchMyEnrollments({ offset: 0, limit: 20 }))
      dispatch(fetchMyAttempts(10))
      dispatch(fetchReferralSummary())
      dispatch(fetchBadgeDashboard())
    }
  }, [isAuthenticated, dispatch])

  if (!mounted || !isInitialized) {
    if (!mounted) return null
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-600/20 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-bold tracking-tight">Loading Edura Hub...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F8FA]"> {/* GitHub-style background color */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-8">
          
          {/* Left Sidebar: Profile & Navigation */}
          <aside className="space-y-6">
            <Sidebar enrollments={enrollments} />
          </aside>

          {/* Center Column: Activity & Feed */}
          <section className="min-w-0">
            <ActivityFeed 
              attempts={attempts} 
              loading={loadingAttempts} 
              user={user} 
            />
          </section>

          {/* Right Column: Achievements & Social */}
          <aside className="hidden xl:block space-y-6">
            <AchievementPanel 
              earnedBadges={earnedBadges} 
              loadingBadges={loadingBadges} 
              referralSummary={referralSummary} 
            />
          </aside>
          
          {/* Mobile/Tablet Fallback for Right Column content */}
          <div className="xl:hidden space-y-6">
             <AchievementPanel 
              earnedBadges={earnedBadges} 
              loadingBadges={loadingBadges} 
              referralSummary={referralSummary} 
            />
          </div>

        </div>
      </main>
    </div>
  )
}
