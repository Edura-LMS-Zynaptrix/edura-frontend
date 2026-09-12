'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useGoogleLogin } from '@react-oauth/google'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { register, googleLoginThunk, fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchPublicStreams } from '@/lib/redux/slices/adminSlice'
import { getSubjects } from '@/lib/api/student'

const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
  'Mullaitivu', 'Vavuniya', 'Puttalam', 'Kurunegala', 'Anuradhapura',
  'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle',
  'Ampara', 'Trincomalee', 'Batticaloa'
]

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { isLoading, error } = useAppSelector((state) => state.auth)
  const { streams } = useAppSelector((state) => state.admin)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirm_password: '',
    full_name: '',
    phone_number: '',
    school: '',
    district: '',
    grade: 6,
    stream_id: '',
    selected_subjects: [] as string[],
    referral_code: '',
    nic_number: '',
  })

  const [isMounted, setIsMounted] = useState(false)
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])

  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [touched, setTouched] = useState({
    email: false,
    phone_number: false,
    district: false,
    nic_number: false,
  })

  useEffect(() => {
    setIsMounted(true)
    const refCode = searchParams.get('ref') || searchParams.get('referral_code')
    if (refCode) {
      setFormData((prev) => ({ ...prev, referral_code: refCode.toUpperCase() }))
    }
    dispatch(fetchPublicStreams())
  }, [searchParams, dispatch])

  useEffect(() => {
    const fetchSubjectsData = async () => {
      try {
        const streamId = formData.grade >= 12 ? formData.stream_id : null
        
        // Don't fetch if grade >= 12 and no stream selected
        if (formData.grade >= 12 && !streamId) {
          setAvailableSubjects([])
          setFormData(prev => ({ ...prev, selected_subjects: [] }))
          return
        }

        const subs = await getSubjects(formData.grade, streamId)
        setAvailableSubjects(subs)
        
        // Clear selected subjects that are no longer available
        setFormData(prev => ({
          ...prev,
          selected_subjects: prev.selected_subjects.filter(s => subs.includes(s))
        }))
      } catch (err) {
        console.error('Failed to fetch subjects:', err)
      }
    }
    fetchSubjectsData()
  }, [formData.grade, formData.stream_id])

  const handleSubjectToggle = (subject: string) => {
    setFormData(prev => {
      const current = prev.selected_subjects
      if (current.includes(subject)) {
        return { ...prev, selected_subjects: current.filter(s => s !== subject) }
      } else {
        return { ...prev, selected_subjects: [...current, subject] }
      }
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'grade' ? parseInt(value) : value
    }))
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
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
  const isPhoneValid = /^\d{10}$/.test(formData.phone_number.replace(/[\s\-\(\)]/g, ''))
  const isDistrictValid = formData.district.trim().length >= 2
  const isNICValid = formData.grade < 12 || /^([0-9]{9}[vVxX]|[0-9]{12})$/.test(formData.nic_number)
  const isFormValid = isEmailValid && isPasswordValid && doPasswordsMatch && isPhoneValid && isDistrictValid && isNICValid && formData.selected_subjects.length > 0 && formData.full_name.trim().length >= 2 && formData.school.trim().length >= 2

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clean up data for backend
    const submissionData = {
      ...formData,
      stream_id: formData.grade >= 12 && formData.stream_id ? formData.stream_id : null,
      referral_code: formData.referral_code.trim() || null,
    }

    try {
      await dispatch(register(submissionData)).unwrap()
      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err) {
      console.error('Registration failed:', err)
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const result = await dispatch(googleLoginThunk(tokenResponse.access_token)).unwrap()
        await dispatch(fetchCurrentUser())
        if (result.needs_profile_completion) {
          const refCode = formData.referral_code?.trim()
          router.push(refCode ? `/auth/complete-profile?ref=${encodeURIComponent(refCode)}` : '/auth/complete-profile')
        } else {
          router.push('/')
        }
      } catch (err) {
        console.error('Google login failed:', err)
      }
    },
    onError: () => console.error('Google sign-in was cancelled'),
    flow: 'implicit',
  })

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-lg p-12 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
            ✓
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Welcome Aboard!
          </h2>
          <p className="text-gray-600 mb-8">
            Your account has been created successfully. Please complete payment to unlock all features.
          </p>
          <div className="flex items-center justify-center gap-3 text-teal-700 bg-teal-50 rounded-lg py-3 px-6">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-medium">Redirecting to login...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left side - Promotional Content */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center p-12 bg-gray-900 overflow-hidden">
        {/* Cinematic Background Image */}
        <div 
          className="absolute inset-0 z-0 opacity-80 mix-blend-overlay"
          style={{
            backgroundImage: "url('/images/register-hero.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />
        
        {/* Glassmorphism Content Card */}
        <div className="relative z-10 max-w-lg w-full mt-auto mb-12 transform transition-all duration-700 hover:scale-[1.02]">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-3xl font-bold mb-4 leading-tight text-white drop-shadow-md">
              Start Your Journey.
            </h2>
            <p className="text-gray-200 text-lg leading-relaxed">
              Create your account to access personalized study tools, track your progress, and rise to the top of the national leaderboards.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-xl">
        <div className="mb-8">
          <Link href="/" className="flex items-center gap-3 mb-6 hover:opacity-80 transition-opacity inline-flex">
            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center text-xl">
              🎓
            </div>
            <h2 className="text-xl font-bold text-gray-900">Edura</h2>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Your Account
          </h1>
          <p className="text-gray-600 text-sm">Sign up to start acing your exams with personalized learning tools</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Google Sign-in */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={!isMounted || isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border-2 border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:border-teal-300 hover:bg-teal-50 transition-all disabled:opacity-50"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>
          <div className="relative mt-5 mb-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-3 bg-white text-gray-400">or register with email</span></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
                placeholder="John Doe"
              />
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
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
              
              {/* Modern Password Strength Meter */}
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
                  type={showConfirmPassword ? "text" : "password"}
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
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
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
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                className={`w-full px-4 py-3 bg-white border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm ${
                  touched.phone_number && !isPhoneValid ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0771234567"
              />
              {touched.phone_number && !isPhoneValid && (
                <p className="text-red-500 text-xs mt-1">Phone number must be exactly 10 digits</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Grade <span className="text-red-500">*</span>
              </label>
              <select
                name="grade"
                value={formData.grade}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
              >
                <option value={5}>Grade 5</option>
                <option value={6}>Grade 6</option>
                <option value={7}>Grade 7</option>
                <option value={8}>Grade 8</option>
                <option value={9}>Grade 9</option>
                <option value={10}>Grade 10 (O/L)</option>
                <option value={11}>Grade 11 (O/L)</option>
                <option value={12}>Grade 12 (A/L)</option>
                <option value={13}>Grade 13 (A/L)</option>
              </select>
            </div>
          </div>

          {formData.grade >= 12 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Educational Stream <span className="text-red-500">*</span>
                </label>
                <select
                  name="stream_id"
                  value={formData.stream_id}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
                >
                  <option value="">Select your stream</option>
                  {streams.filter(s => s.is_active).map(stream => (
                    <option key={stream.id} value={stream.id}>{stream.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  NIC Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nic_number"
                  value={formData.nic_number}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  className={`w-full px-4 py-3 bg-white border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm ${
                    touched.nic_number && !isNICValid ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g. 200123456789 or 981234567V"
                />
                {touched.nic_number && !isNICValid && (
                  <p className="text-red-500 text-xs mt-1">Invalid NIC format. (9 digits + V/X or 12 digits)</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              School <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="school"
              value={formData.school}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm"
              placeholder="Your school name"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              District <span className="text-red-500">*</span>
            </label>
            <select
              name="district"
              value={formData.district}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              className={`w-full px-4 py-3 bg-white border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm ${
                touched.district && !isDistrictValid ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select your district</option>
              {DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Referral Code <span className="text-gray-400">(Optional)</span>
            </label>
            <input
              type="text"
              name="referral_code"
              value={formData.referral_code}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none text-sm uppercase"
              placeholder="Enter referral code"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700">
              Select Your Subjects <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              {availableSubjects.map((subject) => (
                <label 
                  key={subject} 
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.selected_subjects.includes(subject)
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'bg-white border-transparent hover:border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={formData.selected_subjects.includes(subject)}
                    onChange={() => handleSubjectToggle(subject)}
                  />
                  <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                    formData.selected_subjects.includes(subject) ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-300'
                  }`}>
                    {formData.selected_subjects.includes(subject) && (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-medium">{subject}</span>
                </label>
              ))}
              {availableSubjects.length === 0 && (
                <p className="text-gray-400 text-xs col-span-2 py-4 text-center italic" id="subjects-loading">Loading subjects...</p>
              )}
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
            ) : 'Create Account'}
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
