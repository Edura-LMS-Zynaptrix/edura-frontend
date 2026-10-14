'use client'

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { verifyEmail, resendVerification } from '@/lib/api/auth'
import { getErrorMessage } from '@/lib/utils'

type Phase = 'verifying' | 'verified' | 'failed'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [phase, setPhase] = useState<Phase>(token ? 'verifying' : 'failed')
  const [message, setMessage] = useState(token ? '' : 'This verification link is missing its token. Request a new one below.')
  const [email, setEmail] = useState('')
  const [resendNote, setResendNote] = useState('')
  const [sending, setSending] = useState(false)
  // React strict mode runs effects twice in development; one call is enough.
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verifyEmail(token)
      .then(() => setPhase('verified'))
      .catch((err) => {
        setMessage(getErrorMessage(err))
        setPhase('failed')
      })
  }, [token])

  const handleResend = async (e: FormEvent) => {
    e.preventDefault()
    setSending(true)
    setResendNote('')
    try {
      const res = await resendVerification(email.trim())
      setResendNote(res.message)
    } catch (err) {
      setResendNote(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-5xl">🎓</span>
          <h1 className="mt-3 text-3xl font-bold text-white tracking-tight">Edura</h1>
          <p className="mt-1 text-teal-300 text-sm">Email Verification</p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
          {phase === 'verifying' && (
            <div className="text-center space-y-4 py-4">
              <svg className="animate-spin h-10 w-10 mx-auto text-teal-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-gray-300 text-sm">Verifying your email…</p>
            </div>
          )}

          {phase === 'verified' && (
            <div className="text-center space-y-4">
              <div className="text-6xl">✅</div>
              <h2 className="text-xl font-semibold text-white">Email verified</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Thanks for confirming your address. Your account is ready — you can sign in now.
              </p>
              <Link
                href="/login"
                className="inline-block w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg"
              >
                Continue to login
              </Link>
            </div>
          )}

          {phase === 'failed' && (
            <form onSubmit={handleResend} className="space-y-5">
              <div className="text-center">
                <div className="text-5xl mb-2">⚠️</div>
                <h2 className="text-xl font-semibold text-white">Link didn&apos;t work</h2>
                <p className="text-gray-300 text-sm mt-2">{message}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Send me a new link
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
              </div>

              {resendNote && (
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-4 py-3 text-teal-200 text-sm">
                  {resendNote}
                </div>
              )}

              <button
                type="submit"
                disabled={sending || !email}
                className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg"
              >
                {sending ? 'Sending…' : 'Resend verification email'}
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  )
}
