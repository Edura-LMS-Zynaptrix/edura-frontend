'use client'

import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { hideNotification } from '@/lib/redux/slices/uiSlice'

export default function NotificationManager() {
  const dispatch = useAppDispatch()
  const notifications = useAppSelector((state) => state.ui.notifications)
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const activeIds = new Set(notifications.map((notification) => notification.id))

    for (const notification of notifications) {
      if (!notification.duration) continue
      if (!timersRef.current[notification.id]) {
        timersRef.current[notification.id] = setTimeout(() => {
          dispatch(hideNotification(notification.id))
          delete timersRef.current[notification.id]
        }, notification.duration)
      }
    }

    // Clear timers for notifications that were already removed manually.
    for (const [id, timer] of Object.entries(timersRef.current)) {
      if (!activeIds.has(id)) {
        clearTimeout(timer)
        delete timersRef.current[id]
      }
    }

    return () => {
      for (const timer of Object.values(timersRef.current)) {
        clearTimeout(timer)
      }
      timersRef.current = {}
    }
  }, [notifications, dispatch])

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            min-w-[300px] max-w-md px-4 py-3 rounded-lg shadow-lg
            flex items-start justify-between gap-3
            animate-in slide-in-from-right duration-300
            ${
              notification.type === 'success' ? 'bg-green-50 border border-green-200' :
              notification.type === 'error' ? 'bg-red-50 border border-red-200' :
              notification.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-blue-50 border border-blue-200'
            }
          `}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {notification.type === 'warning' && (
                <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <p
              className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-green-800' :
                notification.type === 'error' ? 'text-red-800' :
                notification.type === 'warning' ? 'text-yellow-800' :
                'text-blue-800'
              }`}
            >
              {notification.message}
            </p>
          </div>
          <button
            onClick={() => dispatch(hideNotification(notification.id))}
            className={`flex-shrink-0 ${
              notification.type === 'success' ? 'text-green-600 hover:text-green-800' :
              notification.type === 'error' ? 'text-red-600 hover:text-red-800' :
              notification.type === 'warning' ? 'text-yellow-600 hover:text-yellow-800' :
              'text-blue-600 hover:text-blue-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
