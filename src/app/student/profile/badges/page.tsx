'use client'

import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Award, ShieldCheck, Zap, Target, BookOpen } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchBadgeDashboard } from '@/lib/redux/slices/badgesSlice'
import BadgeCard from '@/components/badges/BadgeCard'

const BadgesPage = () => {
  const dispatch = useAppDispatch()
  const { availableBadges, earnedBadges, isLoading } = useAppSelector((state) => state.badges)

  useEffect(() => {
    dispatch(fetchBadgeDashboard())
  }, [dispatch])

  if (isLoading && availableBadges.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Loading your achievements...</p>
        </div>
      </div>
    )
  }

  const earnedBadgeIds = new Set(earnedBadges.map((eb) => eb.badge_id))

  const categories = [
    { id: 'activity', name: 'Activity Badges', icon: Zap, color: 'text-blue-600' },
    { id: 'performance', name: 'Performance Mastery', icon: Target, color: 'text-purple-600' },
    { id: 'milestone', name: 'Legendary Milestones', icon: ShieldCheck, color: 'text-amber-600' },
  ]

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      {/* Header Section */}
      <section className="bg-white border-b border-gray-200 pt-32 pb-16 px-4">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-teal-50 rounded-3xl flex items-center justify-center mb-6 border border-teal-100 shadow-sm"
          >
            <Award size={40} className="text-teal-600" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">
            Level Up Your <span className="text-teal-600">Learning</span>
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl">
            Complete exams, maintain streaks, and master subjects to earn exclusive badges. 
            Can you collect them all?
          </p>
          
          <div className="mt-10 flex gap-4 md:gap-12">
            <div className="text-center">
              <span className="block text-3xl font-black text-gray-900">{earnedBadges.length}</span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Earned</span>
            </div>
            <div className="w-px bg-gray-200 h-10 self-center" />
            <div className="text-center">
              <span className="block text-3xl font-black text-gray-900">{availableBadges.length - earnedBadges.length}</span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Locked</span>
            </div>
            <div className="w-px bg-gray-200 h-10 self-center" />
            <div className="text-center">
              <span className="block text-3xl font-black text-gray-900">
                {availableBadges.length > 0 ? Math.round((earnedBadges.length / availableBadges.length) * 100) : 0}%
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rank</span>
            </div>
          </div>
        </div>
      </section>

      {/* Badges Grid */}
      <main className="max-w-6xl mx-auto px-4 mt-12 space-y-20">
        {categories.map((cat) => {
          const catBadges = availableBadges.filter((b) => b.category === cat.id)
          if (catBadges.length === 0) return null

          return (
            <motion.section
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className={`p-2 rounded-lg bg-white border border-gray-100 shadow-sm ${cat.color}`}>
                  <cat.icon size={24} />
                </div>
                <h2 className="text-2xl font-black text-gray-900">{cat.name}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {catBadges.map((badge) => {
                  const earned = earnedBadges.find((eb) => eb.badge_id === badge.id)
                  return (
                    <BadgeCard
                      key={badge.id}
                      badge={badge}
                      isEarned={!!earned}
                      awardedAt={earned?.awarded_at}
                    />
                  )
                })}
              </div>
            </motion.section>
          )
        })}
      </main>
    </div>
  )
}

export default BadgesPage
