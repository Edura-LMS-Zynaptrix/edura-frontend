'use client'

import React from 'react'
import Link from 'next/link'
import * as LucideIcons from 'lucide-react'

interface AchievementPanelProps {
  earnedBadges: any[]
  loadingBadges: boolean
  referralSummary: any
}

const AchievementPanel: React.FC<AchievementPanelProps> = ({ earnedBadges, loadingBadges, referralSummary }) => {
  // Map badge names to generated icons
  const getBadgeImage = (name: string) => {
    const slug = name.toLowerCase()
    
    if (slug.includes('early')) return '/badges/early-bird.png'
    if (slug.includes('night') || slug.includes('owl')) return '/badges/night-owl.png'
    if (slug.includes('consistency') || slug.includes('king')) return '/badges/streak-king.png'
    if (slug.includes('perfect') || slug.includes('100')) return '/badges/perfect-100.png'
    if (slug.includes('speed') || slug.includes('demon')) return '/badges/speed-demon.png'
    if (slug.includes('star') || slug.includes('improved')) return '/badges/improved-star.png'
    if (slug.includes('expert')) return '/badges/subject-expert.png'
    if (slug.includes('first step') || slug.includes('master')) return '/badges/exam-master.png'
    if (slug.includes('century') || slug.includes('club')) return '/badges/century-club.png'
    if (slug.includes('scholar')) return '/badges/scholar.png'
    
    return null
  }

  return (
    <div className="space-y-6">
      {/* Achievements Section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            Achievements
            <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">
              {earnedBadges.length}
            </span>
          </h3>
          <Link href="/student/profile/badges" className="text-xs font-semibold text-teal-600 hover:text-teal-700">
            View All
          </Link>
        </div>

        {loadingBadges ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : earnedBadges.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/30">
            <LucideIcons.Lock size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs text-gray-500 font-medium">Earn your first badge!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {earnedBadges.slice(0, 4).map((userBadge) => {
              const badgeImg = getBadgeImage(userBadge.badge.name)
              return (
                <div 
                  key={userBadge.id} 
                  className="group relative bg-white border border-gray-100 rounded-xl p-3 flex flex-col items-center text-center hover:shadow-lg transition-all hover:scale-105 hover:-translate-y-1"
                >
                  <div className="w-16 h-16 mb-2 relative flex items-center justify-center">
                    {badgeImg ? (
                      <img 
                        src={badgeImg} 
                        alt={userBadge.badge.name} 
                        className="w-full h-full object-contain filter drop-shadow-md group-hover:drop-shadow-xl transition-all"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center text-teal-600">
                        <LucideIcons.Award size={24} />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-gray-800 line-clamp-1 group-hover:text-teal-600">
                    {userBadge.badge.name}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Wallet / Referral Section */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <LucideIcons.Wallet size={20} className="text-amber-100" />
            <span className="text-xs font-black uppercase tracking-widest text-amber-100">Wallet Credits</span>
          </div>
          <div className="text-4xl font-black mb-1">
            {referralSummary?.wallet_credits || 0}
          </div>
          <p className="text-[10px] font-bold text-amber-100">Earn more by inviting friends</p>
          
          <div className="mt-6 flex items-center justify-between bg-white/10 rounded-xl p-3 border border-white/20">
            <div>
              <p className="text-[9px] font-black uppercase tracking-tighter text-amber-100">Referral Code</p>
              <p className="text-sm font-black tracking-widest">{referralSummary?.referral_code || '---'}</p>
            </div>
            <button className="bg-white text-amber-600 p-2 rounded-lg hover:bg-amber-50 active:scale-90 transition-all shadow-md">
              <LucideIcons.Copy size={16} />
            </button>
          </div>
        </div>
        <LucideIcons.Coins size={100} className="absolute -bottom-4 -right-4 opacity-10 group-hover:scale-110 transition-transform" />
      </div>

      {/* Rankings Quick Link */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-4">Island Ranking</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-teal-50 rounded-xl border border-teal-100">
            <div>
              <p className="text-[10px] font-bold text-teal-600 uppercase">Overall</p>
              <p className="text-lg font-black text-teal-900">#452</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-teal-600 uppercase">Percentile</p>
              <p className="text-lg font-black text-teal-900">Top 5%</p>
            </div>
          </div>
          <Link 
            href="/student/rankings" 
            className="flex items-center justify-center gap-2 w-full py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            See Leaderboard
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AchievementPanel
