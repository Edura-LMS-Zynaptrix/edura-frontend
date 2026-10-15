'use client'

import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { forgotPasswordThunk } from '@/lib/redux/slices/authSlice'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const dispatch = useAppDispatch()
  const { isLoading } = useAppSelector((state) => state.auth)

  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    const result = await dispatch(forgotPasswordThunk(email))
    if (forgotPasswordThunk.fulfilled.match(result)) {
      setSubmitted(true)
    } else {
      setErrorMsg((result.payload as string) || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <span className="text-5xl">🎓</span>
          <h1 className="mt-3 text-3xl font-bold text-white tracking-tight">Edura</h1>
          <p className="mt-1 text-teal-300 text-sm">Password Recovery</p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
          {submitted ? (
            // ── Success State ────────────────────────────────────────────────
            <div className="text-center space-y-4">
              <div className="text-6xl">📬</div>
              <h2 className="text-xl font-semibold text-white">Check your email</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                If an account with <span className="text-teal-300 font-medium">{email}</span> exists,
                we've sent a password reset link. It will expire in <strong>1 hour</strong>.
              </p>
              <p className="text-gray-400 text-xs">
                Didn't receive it? Check your spam folder or{' '}
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-teal-400 hover:underline"
                >
                  try again
                </button>.
              </p>
              <Link
                href="/login"
                className="inline-block mt-4 text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                ← Back to Login
              </Link>
            </div>
          ) : (
            // ── Input Form ───────────────────────────────────────────────────
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-xl font-semibold text-white">Forgot your password?</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Enter your email and we'll send a reset link.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
              </div>

              <button
                id="forgot-submit-btn"
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Sending…
                  </span>
                ) : 'Send Reset Link'}
              </button>

              <div className="text-center">
                <Link href="/login" className="text-sm text-teal-400 hover:text-teal-300 transition-colors">
                  ← Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
