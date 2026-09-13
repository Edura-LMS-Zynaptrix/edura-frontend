'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { register, login, createProfile, fetchCurrentUser } from '@/lib/redux/slices/authSlice'

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { isLoading, error } = useAppSelector((state) => state.auth)

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    mobile_no: '',
    role: 'student' as 'student' | 'teacher',
  })

  const [isMounted, setIsMounted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [touched, setTouched] = useState({ email: false })

  useEffect(() => { setIsMounted(true) }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
  }

  // Password validation tracking
  const passedCriteria = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /\d/.test(formData.password),
    special: /[@$!%*?&#]/.test(formData.password),
  }
  const strengthScore = Object.values(passedCriteria).filter(Boolean).length
  const isPasswordValid = strengthScore === 5
  const doPasswordsMatch = formData.password === formData.confirm_password && formData.password.length > 0
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
  const isFormValid =
    isEmailValid &&
    isPasswordValid &&
    doPasswordsMatch &&
    formData.first_name.trim().length >= 1 &&
    formData.last_name.trim().length >= 1

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // auth_service only knows email/password/role — it creates the login
      // record but no profile. We chain: register -> login -> create the
      // profile with the name fields -> fetch the merged user into state.
      await dispatch(
        register({ email: formData.email.trim(), password: formData.password, role: formData.role })
      ).unwrap()

      await dispatch(
        login({ email: formData.email.trim(), password: formData.password, remember_me: false })
      ).unwrap()

      await dispatch(
        createProfile({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          mobile_no: formData.mobile_no.trim() || undefined,
        })
      ).unwrap()

      const userData = await dispatch(fetchCurrentUser()).unwrap()

      if (userData.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Registration failed:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left side - Promotional Content */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center p-12 bg-gray-900 overflow-hidden">
        <div
          className="absolute inset-0 z-0 opacity-80 mix-blend-overlay"
          style={{
            backgroundImage: "url('/images/register-hero.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />
        <div className="relative z-10 max-w-lg w-full mt-auto mb-12 transform transition-all duration-700 hover:scale-[1.02]">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-3xl font-bold mb-4 leading-tight text-white drop-shadow-md">
              Start Your Journey.
            </h2>
            <p className="text-gray-200 text-lg leading-relaxed">
              Create your account to access courses, track your progress, and take timed assessments.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-xl">
          <div className="mb-8">
            <Link href="/" className="flex items-center gap-3 mb-6 hover:opacity-80 transition-opacity inline-flex">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center text-xl">🎓</div>
              <h2 className="text-xl font-bold text-gray-900">Edura</h2>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Account</h1>
            <p className="text-gray-600 text-sm">Sign up to start learning with personalized courses and assessments</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
                  placeholder="John"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                className={`w-full px-4 py-3 bg-white border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm ${
                  touched.email && !isEmailValid ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="john@example.com"
              />
              {touched.email && !isEmailValid && (
                <p className="text-red-500 text-xs mt-1">Please enter a valid email address</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    className="w-full px-4 pr-12 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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

                {formData.password && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-1 h-1.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`flex-1 rounded-full transition-colors duration-300 ${
                            strengthScore >= level
                              ? strengthScore < 3
                                ? 'bg-red-500'
                                : strengthScore < 5
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 grid grid-cols-2 gap-1 mt-2">
                      <div className={`flex items-center gap-1 ${passedCriteria.length ? 'text-green-600' : ''}`}>
                        {passedCriteria.length ? '✓' : '○'} 8+ characters
                      </div>
                      <div className={`flex items-center gap-1 ${passedCriteria.uppercase ? 'text-green-600' : ''}`}>
                        {passedCriteria.uppercase ? '✓' : '○'} Uppercase
                      </div>
                      <div className={`flex items-center gap-1 ${passedCriteria.lowercase ? 'text-green-600' : ''}`}>
                        {passedCriteria.lowercase ? '✓' : '○'} Lowercase
                      </div>
                      <div className={`flex items-center gap-1 ${passedCriteria.number ? 'text-green-600' : ''}`}>
                        {passedCriteria.number ? '✓' : '○'} Number
                      </div>
                      <div className={`flex items-center gap-1 col-span-2 ${passedCriteria.special ? 'text-green-600' : ''}`}>
                        {passedCriteria.special ? '✓' : '○'} Special character (@$!%*?&#)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    required
                    className="w-full px-4 pr-12 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
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
                {formData.confirm_password && !doPasswordsMatch && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Mobile Number <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="tel"
                  name="mobile_no"
                  value={formData.mobile_no}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
                  placeholder="0771234567"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  I am a <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isMounted || isLoading || !isFormValid}
              className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMounted && isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                href={`/login${searchParams.get('callbackUrl') ? `?callbackUrl=${encodeURIComponent(searchParams.get('callbackUrl')!)}` : ''}`}
                className="font-medium text-teal-600 hover:text-teal-700"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <RegisterPageContent />
    </Suspense>
  )
}
