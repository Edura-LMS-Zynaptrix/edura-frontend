import React from 'react'
import * as LucideIcons from 'lucide-react'
import { Badge } from '@/lib/redux/slices/badgesSlice'

interface BadgeCardProps {
  badge: Badge
  isEarned: boolean
  awardedAt?: string
}

const categoryStyles = {
  activity: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    glow: 'shadow-blue-500/20',
  },
  performance: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    icon: 'text-teal-600',
    glow: 'shadow-teal-500/20',
  },
  milestone: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-600',
    glow: 'shadow-amber-500/20',
  },
}

const BadgeCard: React.FC<BadgeCardProps> = ({ badge, isEarned, awardedAt }) => {
  // @ts-ignore
  const IconComponent = LucideIcons[badge.icon_name] || LucideIcons.Award
  const styles = categoryStyles[badge.category as keyof typeof categoryStyles] || categoryStyles.activity

  // Standard premium badge images mapping
  const getBadgeImage = (name: string) => {
    const slug = name.toLowerCase()
    
    // Exact or loose name matching for all seed badges
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

  const badgeImg = getBadgeImage(badge.name)

  return (
    <div
      className={`relative group p-6 rounded-2xl border transition-all duration-500 hover:-translate-y-1 ${
        isEarned
          ? `bg-white ${styles.border} shadow-lg ${styles.glow} scale-100`
          : 'bg-gray-50 border-gray-100 grayscale opacity-60 scale-95 hover:scale-100 hover:grayscale-0 hover:opacity-100'
      }`}
    >
      <div className="flex flex-col items-center text-center">
        {/* Icon Container */}
        <div
          className={`w-24 h-24 mb-4 transition-transform duration-500 flex items-center justify-center p-2 rounded-full ${
            isEarned ? 'bg-gradient-to-b from-white to-gray-50 shadow-inner' : 'bg-gray-100'
          }`}
        >
          {badgeImg ? (
            <img 
              src={badgeImg} 
              alt={badge.name} 
              className={`w-full h-full object-contain transition-transform duration-500 group-hover:scale-110 ${
                isEarned ? 'filter drop-shadow-md' : 'opacity-40'
              }`} 
            />
          ) : (
            <IconComponent
              size={48}
              className={`${isEarned ? styles.icon : 'text-gray-400'} group-hover:scale-110 transition-transform`}
            />
          )}
        </div>

        {/* Text Details */}
        <h3 className={`text-lg font-black mb-1 ${isEarned ? 'text-gray-900' : 'text-gray-500'}`}>
          {badge.name}
        </h3>
        
        <p className={`text-sm font-medium leading-relaxed ${isEarned ? 'text-gray-600' : 'text-gray-400'}`}>
          {badge.description}
        </p>

        {isEarned && awardedAt && (
          <div className="mt-4 px-3 py-1 bg-teal-50 border border-teal-100 rounded-full text-[11px] font-black text-teal-700 shadow-sm">
            Unlocked: {new Date(awardedAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Decorative Corner Glow */}
      {isEarned && (
        <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full blur-md animate-pulse ${styles.icon.replace('text', 'bg')}`} />
      )}
    </div>
  )
}

export default BadgeCard
