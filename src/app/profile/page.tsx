'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser, updateProfile, updateProfilePhoto, setPasswordThunk } from '@/lib/redux/slices/authSlice'
import { fetchMyEnrollments } from '@/lib/redux/slices/studentDashboardSlice'
import { fetchAvailableCourses } from '@/lib/redux/slices/coursesSlice'
import { fetchStreams, fetchPublicStreams } from '@/lib/redux/slices/adminSlice'
import { getInitials } from '@/lib/utils/initials'
import { getSubjects } from '@/lib/api/student'

const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
  'Mullaitivu', 'Vavuniya', 'Puttalam', 'Kurunegala', 'Anuradhapura',
  'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle',
  'Ampara', 'Trincomalee', 'Batticaloa',
]

export default function ProfilePage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated, isInitialized } = useAppSelector((state) => state.auth)
  const { enrollments, loadingEnrollments } = useAppSelector((state) => state.studentDashboard)
  const { streams } = useAppSelector((state) => state.admin)

  const [mounted, setMounted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password state
  const [pwForm, setPwForm] = useState({ new_password: '', confirm_password: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    school: '',
    district: '',
    grade: 11,
    stream_id: '',
    selected_subjects: [] as string[],
    nic_number: '',
  })

  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])

  // Sync form with user data when user loads
  useEffect(() => {
    if (user?.profile) {
      setForm({
        full_name: user.profile.full_name || '',
        phone_number: user.profile.phone_number || '',
        school: user.profile.school || '',
        district: user.profile.district || '',
        grade: user.profile.grade || 11,
        stream_id: user.profile.stream_id || '',
        selected_subjects: user.profile.selected_subjects || [],
        nic_number: user.profile.nic_number || '',
      })
    }
  }, [user])

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const queryString = searchParams.toString()
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname
      router.push(`/login?callbackUrl=${encodeURIComponent(fullPath)}`)
    } else if (isAuthenticated) {
      // Always fetch fresh so auth_provider + has_password are current
      dispatch(fetchCurrentUser())
    }
  }, [isInitialized, isAuthenticated, dispatch, router, pathname, searchParams])

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchMyEnrollments())
      dispatch(fetchPublicStreams())
    }
  }, [isAuthenticated, dispatch])

  useEffect(() => {
    const fetchSubsData = async () => {
      try {
        const streamId = form.grade >= 12 ? form.stream_id : null
        
        // Don't fetch if grade >= 12 and no stream selected
        if (form.grade >= 12 && !streamId) {
          setAvailableSubjects([])
          if (isEditing) {
            setForm(prev => ({ ...prev, selected_subjects: [] }))
          }
          return
        }

        const subs = await getSubjects(form.grade, streamId)
        setAvailableSubjects(subs)
        
        // Clear selected subjects that are no longer available for this grade if editing
        if (isEditing) {
          setForm(prev => ({
            ...prev,
            selected_subjects: prev.selected_subjects.filter(s => subs.includes(s))
          }))
        }
      } catch (err) {
        console.error('Failed to fetch subjects:', err)
      }
    }
    fetchSubsData()
  }, [form.grade, form.stream_id, isEditing])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: name === 'grade' ? parseInt(value) : value }))
  }

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

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    const isNICValid = form.grade < 12 || /^([0-9]{9}[vVxX]|[0-9]{12})$/.test(form.nic_number)
    
    if (form.grade >= 12 && !isNICValid) {
      setSaveError('Invalid NIC format. Format should be 9 digits + V/X or 12 digits.')
      setSaving(false)
      return
    }

    try {
      const resAction = await dispatch(updateProfile(form))
      if (updateProfile.fulfilled.match(resAction)) {
        await dispatch(fetchCurrentUser())
        await dispatch(fetchAvailableCourses())
        setIsEditing(false)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        setSaveError(resAction.payload as string || 'Failed to save changes. Please try again.')
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset form to current user values
    if (user?.profile) {
      setForm({
        full_name: user.profile.full_name || '',
        phone_number: user.profile.phone_number || '',
        school: user.profile.school || '',
        district: user.profile.district || '',
        grade: user.profile.grade || 11,
        stream_id: user.profile.stream_id || '',
        selected_subjects: user.profile.selected_subjects || [],
        nic_number: user.profile.nic_number || '',
      })
    }
    setIsEditing(false)
    setSaveError('')
  }

  const handlePhotoClick = () => {
    if (fileInputRef.current) fileInputRef.current.click()
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resAction = await dispatch(updateProfilePhoto(formData))
      if (updateProfilePhoto.fulfilled.match(resAction)) {
        await dispatch(fetchCurrentUser())
      } else {
        setSaveError(resAction.payload as string || 'Photo upload failed.')
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Photo upload failed.')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  useEffect(() => { setMounted(true) }, [])

  if (!mounted || !isInitialized || loadingEnrollments) {
    if (!mounted) return null
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-semibold">Loading your profile...</p>
        </div>
      </div>
    )
  }

  const initials = getInitials(user?.profile?.full_name, user?.email)

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">

          {/* Profile Header */}
          <div className="bg-white border border-gray-200 rounded-xl p-8 mb-6 shadow-sm">
            <div className="flex items-start gap-6">
              <div className="relative">
                {user?.profile?.profile_photo_url ? (
                  <img
                    src={user.profile.profile_photo_url}
                    alt={user?.profile?.full_name || 'Profile'}
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold text-3xl border-4 border-gray-200">
                    {initials}
                  </div>
                )}
                <button
                  onClick={handlePhotoClick}
                  disabled={uploadingPhoto}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center hover:bg-teal-700 transition-colors border-2 border-white disabled:opacity-60"
                  title="Change profile photo"
                >
                  {uploadingPhoto ? (
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {user?.profile?.full_name || user?.email}
                </h2>
                <p className="text-gray-600 mb-4">{user?.email}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
                    Grade {user?.profile?.grade}
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {user?.profile?.district}
                  </span>
                  {user?.profile?.grade >= 12 && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${user?.profile?.nic_number ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      NIC: {user?.profile?.nic_number || 'Missing'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Success / Error banners */}
          {saveSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Profile updated successfully!
            </div>
          )}
          {saveError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {saveError}
            </div>
          )}

          {/* Missing NIC Warning for Grade 12-13 */}
          {(user?.profile?.grade >= 12) && (!user?.profile?.nic_number || user.profile.nic_number.trim() === '') && !isEditing && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-amber-900 mb-1">NIC Information Required</h4>
                <p className="text-amber-800 text-sm mb-3">
                  As a Grade {user?.profile?.grade || form.grade} student, adding your National Identity Card (NIC) number is mandatory for account verification and exam eligibility.
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-amber-900 font-semibold text-sm underline hover:no-underline"
                >
                  Update your NIC now →
                </button>
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Personal Information</h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  name="full_name"
                  value={isEditing ? form.full_name : (user?.profile?.full_name || '')}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-colors outline-none ${
                    isEditing
                      ? 'border-teal-400 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500'
                      : 'border-gray-300 bg-gray-50 text-gray-700 cursor-default'
                  }`}
                />
              </div>

              {/* Email (always read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm cursor-default"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={isEditing ? form.phone_number : (user?.profile?.phone_number || '')}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-colors outline-none ${
                    isEditing
                      ? 'border-teal-400 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500'
                      : 'border-gray-300 bg-gray-50 text-gray-700 cursor-default'
                  }`}
                />
              </div>

              {/* Grade — locked after registration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Grade
                  <span className="ml-2 text-xs text-gray-400 font-normal">(cannot be changed)</span>
                </label>
                <input
                  type="text"
                  value={user?.profile?.grade ? `Grade ${user.profile.grade}` : ''}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm cursor-default"
                />
              </div>

              {/* Stream Selection (Conditional) */}
              {((isEditing && form.grade >= 12) || (!isEditing && user?.profile?.grade >= 12)) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Educational Stream</label>
                  {isEditing ? (
                    <select
                      name="stream_id"
                      value={form.stream_id}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-teal-400 rounded-lg bg-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    >
                      <option value="">Select stream</option>
                      {streams.filter(s => s.is_active).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={streams.find(s => s.id === user?.profile?.stream_id)?.name || 'Not Selected'}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm cursor-default"
                    />
                  )}
                </div>
              )}

              {/* School */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">School</label>
                <input
                  type="text"
                  name="school"
                  value={isEditing ? form.school : (user?.profile?.school || '')}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-colors outline-none ${
                    isEditing
                      ? 'border-teal-400 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500'
                      : 'border-gray-300 bg-gray-50 text-gray-700 cursor-default'
                  }`}
                />
              </div>

              {/* District */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">District</label>
                {isEditing ? (
                  <select
                    name="district"
                    value={form.district}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-teal-400 rounded-lg bg-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  >
                    <option value="">Select district</option>
                    {DISTRICTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={user?.profile?.district || ''}
                    disabled
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm cursor-default"
                  />
                )}
              </div>

              {/* NIC Number (Conditional for Grade 12-13) */}
              {(isEditing ? form.grade >= 12 : user?.profile?.grade >= 12) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">NIC Number</label>
                  <input
                    type="text"
                    name="nic_number"
                    value={isEditing ? form.nic_number : (user?.profile?.nic_number || '')}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="e.g. 200123456789"
                    className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-colors outline-none ${
                        isEditing
                        ? 'border-teal-400 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500'
                        : 'border-gray-300 bg-gray-50 text-gray-700 cursor-default'
                    }`}
                  />
                  {isEditing && form.grade >= 12 && (
                    <p className="text-[10px] text-gray-400 mt-1">Required for Grade 12-13 students.</p>
                  )}
                </div>
              )}
            </div>

            {/* Subjects Selection */}
            {form.grade && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Selected Subjects</label>
                {isEditing ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {availableSubjects.map((subject) => (
                      <label
                        key={subject}
                        className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${
                          form.selected_subjects.includes(subject)
                            ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20'
                            : 'border-gray-200 bg-white hover:border-teal-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.selected_subjects.includes(subject)}
                          onChange={() => handleSubjectToggle(subject)}
                          className="w-4 h-4 text-teal-600 rounded border-gray-300 accent-teal-600 focus:ring-teal-500 transition-colors"
                        />
                        <span className="ml-3 text-sm font-medium text-gray-700">{subject}</span>
                      </label>
                    ))}
                    {availableSubjects.length === 0 && (
                      <div className="col-span-full text-sm text-gray-500 italic py-2">
                        {form.grade >= 12 && !form.stream_id 
                          ? 'Please select an educational stream first.'
                          : 'No subjects available for the selected grade/stream.'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user?.profile?.selected_subjects?.length ? (
                      user.profile.selected_subjects.map((subject: string) => (
                        <span key={subject} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium border border-gray-200">
                          {subject}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500 italic">No subjects selected</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Edit mode action buttons */}
            {isEditing && (
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* ── Password & Security ─────────────────────────────── */}
          {user?.has_password !== undefined && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Password &amp; Security</h3>

              {!user.has_password ? (
                // Set Password — Google-only users
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Your account uses Google Sign-In and has no password yet.
                    Set a password to also log in with email &amp; password.
                  </p>
                  {pwError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{pwError}</div>
                  )}
                  {pwSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{pwSuccess}</div>
                  )}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setPwError('')
                      if (pwForm.new_password !== pwForm.confirm_password) {
                        setPwError('Passwords do not match.')
                        return
                      }
                      if (pwForm.new_password.length < 8) {
                        setPwError('Password must be at least 8 characters.')
                        return
                      }
                      setPwLoading(true)
                      const result = await dispatch(setPasswordThunk(pwForm))
                      setPwLoading(false)
                      if (setPasswordThunk.fulfilled.match(result)) {
                        setPwSuccess('Password set! You can now log in with email + password.')
                        setPwForm({ new_password: '', confirm_password: '' })
                        dispatch(fetchCurrentUser())
                      } else {
                        setPwError((result.payload as string) || 'Failed to set password.')
                      }
                    }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <input
                          id="set-new-password"
                          type="password"
                          required
                          minLength={8}
                          placeholder="At least 8 characters"
                          value={pwForm.new_password}
                          onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                        <input
                          id="set-confirm-password"
                          type="password"
                          required
                          minLength={8}
                          placeholder="Repeat password"
                          value={pwForm.confirm_password}
                          onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>
                    </div>
                    <button
                      id="set-password-submit-btn"
                      type="submit"
                      disabled={pwLoading}
                      className="mt-1 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                      {pwLoading ? 'Setting…' : 'Set Password'}
                    </button>
                  </form>
                </>
              ) : (
                // Change Password — email users (or Google users who already set a password)
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    A password is set on your account. To change it, we'll send a reset link to <strong>{user.email}</strong>.
                  </p>
                  <Link
                    href="/forgot-password"
                    className="inline-block px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    Send Change Password Link
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Enrollments */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">My Enrollments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-2">Courses</p>
                <p className="text-2xl font-bold text-gray-900 mb-3">{enrollments.courses.length}</p>
                <div className="space-y-2">
                  {enrollments.courses.slice(0, 3).map((item) => (
                    <Link
                      key={item.enrollment_id}
                      href={`/student/courses/${item.course.id}`}
                      className="block text-sm text-blue-600 hover:text-blue-800"
                    >
                      {item.course.title}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">Exams</p>
                <p className="text-2xl font-bold text-gray-900 mb-3">{enrollments.exams.length}</p>
                <div className="space-y-2">
                  {enrollments.exams.slice(0, 3).map((item) => (
                    <p key={item.enrollment_id} className="text-sm text-gray-700">
                      {item.exam.title}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
