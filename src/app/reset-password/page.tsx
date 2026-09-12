'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { resetPasswordThunk } from '@/lib/redux/slices/authSlice'
import Link from 'next/link'

function ResetPasswordContent() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoading } = useAppSelector((state) => state.auth)

  const token = searchParams.get('token') || ''

  const [form, setForm] = useState({ new_password: '', confirm_password: '' })
  const [showPass, setShowPass] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) setErrorMsg('Invalid or missing reset link. Please request a new one.')
  }, [token])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (form.new_password !== form.confirm_password) {
      setErrorMsg('Passwords do not match.')
      return
    }
    if (form.new_password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.')
      return
    }

    const result = await dispatch(resetPasswordThunk({ token, ...form }))
    if (resetPasswordThunk.fulfilled.match(result)) {
      setSuccessMsg('Password reset successfully! Redirecting to login…')
      const callbackUrl = searchParams.get('callbackUrl')
      const target = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login'
      setTimeout(() => router.push(target), 2500)
    } else {
      setErrorMsg((result.payload as string) || 'Reset failed. The link may have expired.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl">🎓</span>
          <h1 className="mt-3 text-3xl font-bold text-white tracking-tight">Edura</h1>
          <p className="mt-1 text-teal-300 text-sm">Set New Password</p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
          {successMsg ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <p className="text-green-400 font-medium">{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-xl font-semibold text-white">Create new password</h2>
                <p className="text-gray-400 text-sm mt-1">Must be at least 8 characters.</p>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {errorMsg}{' '}
                  {!token && (
                    <Link href="/forgot-password" className="underline text-teal-400">
                      Request a new link
                    </Link>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="reset-new-password"
                    type={showPass ? 'text' : 'password'}
                    name="new_password"
                    required
                    minLength={8}
                    value={form.new_password}
                    onChange={handleChange}
                    placeholder="At least 8 characters"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition pr-12"
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition text-sm">
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="reset-confirm-password"
                  type={showPass ? 'text' : 'password'}
                  name="confirm_password"
                  required
                  minLength={8}
                  value={form.confirm_password}
                  onChange={handleChange}
                  placeholder="Repeat your password"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
              </div>

              <button
                id="reset-submit-btn"
                type="submit"
                disabled={isLoading || !token}
                className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Resetting…
                  </span>
                ) : 'Reset Password'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        Loading…
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
