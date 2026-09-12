'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser, completeProfileThunk } from '@/lib/redux/slices/authSlice'
import { fetchPublicStreams } from '@/lib/redux/slices/adminSlice'
import { getSubjects } from '@/lib/api/student'

const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
  'Mullaitivu', 'Vavuniya', 'Puttalam', 'Kurunegala', 'Anuradhapura',
  'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle',
  'Ampara', 'Trincomalee', 'Batticaloa'
]

function CompleteProfilePageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { isAuthenticated, isInitialized, user } = useAppSelector((s) => s.auth)
  const { streams } = useAppSelector((s) => s.admin)

  const [form, setForm] = useState({
    phone_number: '',
    school: '',
    district: '',
    grade: 11,
    stream_id: '',
    selected_subjects: [] as string[],
    referral_code: '',
    nic_number: '',
  })
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState({
    phone_number: false,
    district: false,
    nic_number: false,
  })

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const queryString = searchParams.toString()
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname
      router.push(`/login?callbackUrl=${encodeURIComponent(fullPath)}`)
    }
  }, [isInitialized, isAuthenticated, router, pathname, searchParams])

  useEffect(() => {
    const refCode = searchParams.get('ref') || searchParams.get('referral_code')
    if (refCode) {
      setForm((prev) => ({ ...prev, referral_code: refCode.toUpperCase() }))
    }
    dispatch(fetchPublicStreams())
  }, [searchParams, dispatch])

  useEffect(() => {
    const fetchSubsData = async () => {
      try {
        const streamId = form.grade >= 12 ? form.stream_id : null
        
        // Don't fetch if grade >= 12 and no stream selected
        if (form.grade >= 12 && !streamId) {
          setAvailableSubjects([])
          setForm(prev => ({ ...prev, selected_subjects: [] }))
          return
        }

        const subs = await getSubjects(form.grade, streamId)
        setAvailableSubjects(subs)
        
        // Clear selected subjects that are no longer available for this grade
        setForm(prev => ({
          ...prev,
          selected_subjects: prev.selected_subjects.filter(s => subs.includes(s))
        }))
      } catch (err) {
        console.error('Failed to fetch subjects:', err)
      }
    }
    fetchSubsData()
  }, [form.grade, form.stream_id])

  const handleSubjectToggle = (subject: string) => {
    setForm(prev => {
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
    setForm(prev => ({ ...prev, [name]: name === 'grade' ? parseInt(value) : value }))
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
  }

  const isPhoneValid = /^\d{10}$/.test(form.phone_number.replace(/[\s\-\(\)]/g, ''))
  const isDistrictValid = form.district.trim().length >= 2
  const isNICValid = form.grade < 12 || /^([0-9]{9}[vVxX]|[0-9]{12})$/.test(form.nic_number)
  const isFormValid = isPhoneValid && isDistrictValid && isNICValid && form.school.trim().length >= 2 && form.selected_subjects.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.phone_number || !form.school || !form.district) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const dataToSubmit = {
        ...form,
        stream_id: form.grade >= 12 ? (form.stream_id || null) : null,
        referral_code: form.referral_code || null,
      }
      await dispatch(completeProfileThunk(dataToSubmit)).unwrap()
      await dispatch(fetchCurrentUser())
      router.push('/')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const googlePicture = user?.profile?.profile_photo_url

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 max-w-lg w-full">
        
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center text-lg">🎓</div>
            <span className="text-lg font-bold text-gray-900">Edura</span>
          </Link>

          {/* Google profile picture */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            {googlePicture ? (
              <img
                src={googlePicture}
                alt="Profile"
                className="w-full h-full rounded-full border-4 border-teal-100 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + (user?.full_name || 'Student') + '&background=ccfbf1&color=0d9488';
                }}
              />
            ) : (
              <div className="w-full h-full rounded-full bg-teal-100 flex items-center justify-center text-2xl font-bold text-teal-700 uppercase">
                {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'ST'}
              </div>
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Profile 🎉</h1>
          
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-left">
            <p className="text-amber-800 text-sm font-bold flex items-center gap-2">
              <span className="text-lg">⚠️</span> Mandatory Step
            </p>
            <p className="text-amber-700 text-[13px] mt-1 leading-relaxed">
              To protect student data and personalize your learning experience, you <strong>must complete your profile</strong> before you can browse or access any courses.
            </p>
          </div>

          <p className="text-gray-500 text-sm">
            We just need a few more details to set up your student account. 
            This is a one-time process.
          </p>
        </div>

        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone_number"
              value={form.phone_number}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              placeholder="0771234567"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm transition-colors ${
                touched.phone_number && !isPhoneValid ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {touched.phone_number && !isPhoneValid && (
              <p className="text-red-500 text-xs mt-1">Phone number must be exactly 10 digits</p>
            )}
          </div>

          {/* Grade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Grade <span className="text-red-500">*</span>
            </label>
            <select
              name="grade"
              value={form.grade}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm bg-white transition-colors"
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

          {/* Stream and NIC for Grade 12-13 */}
          {form.grade >= 12 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Educational Stream <span className="text-red-500">*</span>
                </label>
                <select
                  name="stream_id"
                  value={form.stream_id}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm bg-white transition-colors"
                >
                  <option value="">Select your stream</option>
                  {streams.filter(s => s.is_active).map(stream => (
                    <option key={stream.id} value={stream.id}>{stream.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  NIC Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nic_number"
                  value={form.nic_number}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  placeholder="e.g. 200123456789"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm transition-colors ${
                    touched.nic_number && !isNICValid ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {touched.nic_number && !isNICValid && (
                  <p className="text-red-500 text-xs mt-1">Invalid NIC format. (9 digits + V/X or 12 digits)</p>
                )}
              </div>
            </div>
          )}

          {/* School */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              School <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="school"
              value={form.school}
              onChange={handleChange}
              required
              placeholder="Your school name"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm transition-colors"
            />
          </div>

          {/* District */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              District <span className="text-red-500">*</span>
            </label>
            <select
              name="district"
              id="district-select"
              value={form.district}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm bg-white transition-colors min-h-[48px]"
            >
              <option value="">Select your district</option>
              {DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {touched.district && !isDistrictValid && (
              <p className="text-red-500 text-xs mt-1">Please select your district</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Referral Code <span className="text-gray-400">(Optional)</span>
            </label>
            <input
              type="text"
              name="referral_code"
              value={form.referral_code}
              onChange={handleChange}
              placeholder="Enter referral code"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm transition-colors uppercase"
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
                    form.selected_subjects.includes(subject)
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'bg-white border-transparent hover:border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={form.selected_subjects.includes(subject)}
                    onChange={() => handleSubjectToggle(subject)}
                  />
                  <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                    form.selected_subjects.includes(subject) ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-300'
                  }`}>
                    {form.selected_subjects.includes(subject) && (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-medium">{subject}</span>
                </label>
              ))}
              {availableSubjects.length === 0 && (
                <p className="text-gray-400 text-xs col-span-2 py-4 text-center italic">Loading subjects...</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : 'Complete My Profile →'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your information is kept private and only used to personalise your learning experience.
        </p>
      </div>
    </div>
  )
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-teal-50 to-gray-50" />}>
      <CompleteProfilePageContent />
    </Suspense>
  )
}
