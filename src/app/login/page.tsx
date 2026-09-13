'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { login, fetchCurrentUser } from '@/lib/redux/slices/authSlice'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { isAuthenticated, isLoading, error, user, needsProfileCompletion } = useAppSelector((state) => state.auth)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const refCode = (searchParams.get('ref') || searchParams.get('referral_code') || '').trim()
    const callbackUrl = searchParams.get('callbackUrl') || '/'
    const profileUrl = refCode ? `/auth/complete-profile?ref=${encodeURIComponent(refCode)}` : '/auth/complete-profile'

    if (isAuthenticated && user) {
      if (needsProfileCompletion) {
        router.push(profileUrl)
      } else if (user.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push(callbackUrl)
      }
    }
  }, [isAuthenticated, user, needsProfileCompletion, router, searchParams])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const loginPayload = {
        email: formData.email.trim(),
        password: formData.password,
        remember_me: rememberMe,
      }

      await dispatch(login(loginPayload)).unwrap()
      const userData = await dispatch(fetchCurrentUser()).unwrap()

      // Redirect based on role
      const callbackUrl = searchParams.get('callbackUrl') || '/'
      if (userData.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push(callbackUrl)
      }
    } catch (err: any) {
      console.error('Login failed:', err || 'Unknown error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <Link href="/" className="flex items-center gap-3 mb-8 hover:opacity-80 transition-opacity inline-flex">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center text-xl">
                🎓
              </div>
              <h2 className="text-xl font-bold text-gray-900">Edura</h2>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back!
            </h1>
            <p className="text-gray-600 text-sm">Sign in to access your dashboard and continue optimizing your learning process.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-12 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-gray-600 cursor-pointer">
                  Remember me
                </label>
              </div>

              <div>
                <Link href="/forgot-password" className="font-medium text-teal-600 hover:text-teal-700">
                  Forgot Password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isMounted || isLoading}
              className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMounted && isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-8">
            Don't have an Account?{' '}
            <Link href="/register" className="font-medium text-teal-600 hover:text-teal-700">
              Sign Up
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Promotional Content */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center p-12 bg-gray-900 overflow-hidden">
        {/* Cinematic Background Image */}
        <div 
          className="absolute inset-0 z-0 opacity-80 mix-blend-overlay"
          style={{
            backgroundImage: "url('/images/login-hero.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />
        
        {/* Glassmorphism Content Card */}
        <div className="relative z-10 max-w-lg w-full mt-auto mb-12 transform transition-all duration-700 hover:scale-[1.02]">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-3xl font-bold mb-4 leading-tight text-white drop-shadow-md">
              Unlock Your Highest Potential.
            </h2>
            <p className="text-gray-200 text-lg leading-relaxed">
              Join thousands of students mastering their exams through intelligent, personalized learning metrics and real-time national leaderboards.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginPageContent />
    </Suspense>
  )
}
