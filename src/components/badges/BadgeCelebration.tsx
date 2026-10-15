'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as LucideIcons from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { clearNewlyEarned } from '@/lib/redux/slices/badgesSlice'

const BadgeCelebration: React.FC = () => {
  const dispatch = useAppDispatch()
  const { newlyEarned } = useAppSelector((state) => state.badges)
  const [currentBadgeIndex, setCurrentBadgeIndex] = useState(0)

  useEffect(() => {
    if (newlyEarned.length > 0) {
      setCurrentBadgeIndex(0)
    }
  }, [newlyEarned])

  if (newlyEarned.length === 0) return null

  const badge = newlyEarned[currentBadgeIndex]
  // @ts-ignore
  const IconComponent = LucideIcons[badge.icon_name] || LucideIcons.Award

  const handleNext = () => {
    if (currentBadgeIndex < newlyEarned.length - 1) {
      setCurrentBadgeIndex(currentBadgeIndex + 1)
    } else {
      dispatch(clearNewlyEarned())
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={badge.id}
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 1.1, opacity: 0 }}
          className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl overflow-hidden text-center"
        >
          {/* Confetti Background effect (Simplified) */}
          <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  y: [-20, 400],
                  x: [Math.random() * 400, Math.random() * 400],
                  rotate: [0, 360],
                }}
                transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, ease: 'linear' }}
                className="absolute w-2 h-2 rounded-full bg-teal-500"
              />
            ))}
          </div>

          <div className="relative">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-teal-50 mb-6 border-4 border-teal-100 shadow-xl">
              <IconComponent size={48} className="text-teal-600 animate-bounce" />
            </div>

            <h2 className="text-2xl font-black text-gray-900 mb-2">Achievement Unlocked!</h2>
            <p className="text-teal-600 font-bold text-lg mb-4">{badge.name}</p>
            
            <p className="text-gray-600 mb-8 px-4">
              {badge.description}
            </p>

            <button
              onClick={handleNext}
              className="w-full py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-teal-600/30 hover:shadow-teal-600/50 hover:scale-[1.02] transition-all active:scale-95"
            >
              {currentBadgeIndex < newlyEarned.length - 1 ? 'Next Badge!' : 'Awesome!'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default BadgeCelebration
