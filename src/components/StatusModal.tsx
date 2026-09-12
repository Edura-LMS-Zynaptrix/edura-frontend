'use client'

import React from 'react'

interface StatusModalProps {
  title: string
  message: string
  type?: 'info' | 'error' | 'warning' | 'success'
  onConfirm: () => void
  buttonText?: string
}

export function StatusModal({ title, message, type = 'info', onConfirm, buttonText = 'Close' }: StatusModalProps) {
  const themes = {
    info: { bg: 'bg-blue-50', text: 'text-blue-800', icon: 'text-blue-600', dot: 'bg-blue-100', btn: 'bg-blue-600 hover:bg-blue-700' },
    error: { bg: 'bg-red-50', text: 'text-red-800', icon: 'text-red-600', dot: 'bg-red-100', btn: 'bg-red-600 hover:bg-red-700' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-800', icon: 'text-amber-600', dot: 'bg-amber-100', btn: 'bg-orange-600 hover:bg-orange-700' },
    success: { bg: 'bg-emerald-50', text: 'text-emerald-800', icon: 'text-emerald-600', dot: 'bg-emerald-100', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  }
  const theme = themes[type]

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all scale-100">
        <div className={`w-16 h-16 ${theme.dot} rounded-full flex items-center justify-center mx-auto mb-4`}>
          {type === 'error' && (
             <svg className={`w-8 h-8 ${theme.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
          )}
          {type === 'warning' && (
             <svg className={`w-8 h-8 ${theme.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
          )}
          {type === 'success' && (
             <svg className={`w-8 h-8 ${theme.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
             </svg>
          )}
          {type === 'info' && (
             <svg className={`w-8 h-8 ${theme.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
          )}
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <button
          onClick={onConfirm}
          className={`w-full py-3 ${theme.btn} text-white rounded-xl font-bold transition-colors shadow-lg shadow-teal-900/10`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}
