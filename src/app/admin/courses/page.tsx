'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchStreams } from '@/lib/redux/slices/adminSlice'
import { fetchCourses, createCourse, updateCourse, deleteCourse, AdminCourse, uploadImageThunk, deleteImageThunk } from '@/lib/redux/slices/coursesSlice'
import { getGradeSubjects, type GradeSubject } from '@/lib/api/admin'
import { getErrorMessage } from '@/lib/utils'
import EnrollmentAccessModal from '@/components/admin/EnrollmentAccessModal'
import { PerformanceAnalysis } from './PerformanceAnalysis'
import { AlertCircle, X } from 'lucide-react'

export default function AdminCoursesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth)
  const { courses, isLoading: loadingData, error: storeError } = useAppSelector((state) => state.courses)
  const { streams } = useAppSelector((state) => state.admin)

  const [localError, setLocalError] = useState('')
  const [courseImageFile, setCourseImageFile] = useState<File | null>(null)
  const [removeCourseImage, setRemoveCourseImage] = useState(false)
  const [isCreatingCourse, setIsCreatingCourse] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [selectedForAccess, setSelectedForAccess] = useState<{ id: string, title: string } | null>(null)
  const [analyzingCourse, setAnalyzingCourse] = useState<{ id: string, title: string } | null>(null)

  // Subjects for the current grade in the form
  const [gradeSubjects, setGradeSubjects] = useState<GradeSubject[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(false)

  // Filter state
  const [filterForm, setFilterForm] = useState({
    search: '',
    grade: 'all',
    stream_id: 'all'
  })
  const [activeType, setActiveType] = useState<'exam' | 'video'>('exam')

  const [courseForm, setCourseForm] = useState({
    title: '',
    subject: '',
    grade: 10,
    course_type: 'exam' as 'exam' | 'video',
    image_url: '',
    image_public_id: '',
    price: '0',
    description: '',
    stream_ids: [] as string[],
  })

  const error = storeError || localError

  const uploadImageToCloudinary = async (file: File) => {
    const resultAction = await dispatch(uploadImageThunk({ file, entity: 'courses' }))
    if (uploadImageThunk.fulfilled.match(resultAction)) {
      return resultAction.payload
    } else {
      throw new Error(resultAction.payload as string || 'Image upload failed')
    }
  }

  const deleteImageFromCloudinary = async (publicId: string | null | undefined) => {
    if (!publicId) return
    try { await dispatch(deleteImageThunk(publicId)) } catch (err) { console.error('Failed to delete image:', err) }
  }

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const queryString = searchParams.toString()
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname
      router.push(`/login?callbackUrl=${encodeURIComponent(fullPath)}`)
      return
    }
    if (isAuthenticated && !user && !isLoading) {
      dispatch(fetchCurrentUser())
      return
    }
    if (isAuthenticated && user && user.role !== 'admin' && user.role !== 'super_admin') {
      router.push('/')
      return
    }
    if (isAuthenticated && user) {
      dispatch(fetchCourses())
      dispatch(fetchStreams())
    }
  }, [isAuthenticated, isInitialized, user, dispatch, router, pathname, isLoading, searchParams])

  // Reload subjects when grade changes (only while a modal is open)
  useEffect(() => {
    if (!showCreateModal && !showEditModal) return
    setLoadingSubjects(true)
    getGradeSubjects(courseForm.grade)
      .then((data) => {
        const active = data.filter((s) => s.is_active)
        setGradeSubjects(active)
        // Reset subject if current value no longer exists for this grade
        if (courseForm.subject && !active.some((s) => s.name === courseForm.subject)) {
          setCourseForm((prev) => ({ ...prev, subject: active[0]?.name ?? '' }))
        }
      })
      .catch(() => setGradeSubjects([]))
      .finally(() => setLoadingSubjects(false))
  }, [courseForm.grade, showCreateModal, showEditModal])

  const validateCourseForm = (): { title: string; subject: string; grade: number; price: number; finalDescription: string | null; stream_ids: string[] } | null => {
    const title = courseForm.title ? courseForm.title.trim() : ''
    if (!title) { setLocalError('Please enter course title'); return null }

    const subject = courseForm.subject ? courseForm.subject.trim() : ''
    if (!subject) { setLocalError('Please enter course subject'); return null }

    const grade = Number(courseForm.grade)
    if (isNaN(grade) || grade < 5 || grade > 13) { setLocalError('Please enter a valid grade (5-13)'); return null }

    const price = courseForm.price === '' ? 0 : Number(courseForm.price)
    if (isNaN(price) || price < 0) { setLocalError('Please enter a valid price'); return null }

    const description = courseForm.description ? courseForm.description.trim() : null
    const finalDescription = description && description.length > 0 ? description : null

    const stream_ids = courseForm.grade >= 12 ? courseForm.stream_ids : []

    return { title, subject, grade, price, finalDescription, stream_ids }
  }

  const handleCreateCourse = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setLocalError('')
      setIsCreatingCourse(true)

      const validated = validateCourseForm()
      if (!validated) { setIsCreatingCourse(false); return }
      const { title, subject, grade, price, finalDescription, stream_ids } = validated

      let imageUrl: string | null = null
      let imagePublicId: string | null = null

      // Upload image if file was selected
      if (courseImageFile) {
        try {
          const uploadResult = await uploadImageToCloudinary(courseImageFile)
          imageUrl = uploadResult.image_url || null
          imagePublicId = uploadResult.image_public_id || null
        } catch (err: any) {
          setLocalError(getErrorMessage(err) || 'Failed to upload course image')
          setIsCreatingCourse(false)
          return
        }
      }

      await dispatch(createCourse({
        title: title,
        subject: subject,
        grade: grade,
        course_type: courseForm.course_type,
        image_url: imageUrl,
        image_public_id: imagePublicId,
        price: price,
        description: finalDescription,
        stream_ids: stream_ids,
      })).unwrap()

      setCourseForm({ title: '', subject: '', grade: 10, course_type: 'exam', image_url: '', image_public_id: '', price: '0', description: '', stream_ids: [] })
      setCourseImageFile(null)
      setShowCreateModal(false)
      setLocalError('')
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to create course')
    } finally {
      setIsCreatingCourse(false)
    }
  }

  const openCreateModal = () => {
    setLocalError('')
    setGradeSubjects([])
    setCourseForm({ title: '', subject: '', grade: 10, course_type: 'exam', image_url: '', image_public_id: '', price: '0', description: '', stream_ids: [] })
    setCourseImageFile(null)
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setLocalError('')
    setCourseImageFile(null)
  }

  const openEditModal = (course: AdminCourse) => {
    setLocalError('')
    setCourseForm({
      title: course.title,
      subject: course.subject,
      grade: course.grade,
      course_type: course.course_type as 'exam' | 'video',
      image_url: course.image_url || '',
      image_public_id: course.image_public_id || '',
      price: String(course.price),
      description: course.description || '',
      stream_ids: course.stream_ids || [],
    })
    setCourseImageFile(null)
    setRemoveCourseImage(false)
    setEditingCourseId(course.id)
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setLocalError('')
    setCourseImageFile(null)
    setRemoveCourseImage(false)
    setEditingCourseId(null)
  }

  const handleEditCourse = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingCourseId) return

    try {
      setLocalError('')
      setIsCreatingCourse(true)

      const validated = validateCourseForm()
      if (!validated) { setIsCreatingCourse(false); return }
      const { title, subject, grade, price, finalDescription, stream_ids } = validated

      let imageUrl: string | null = null
      let imagePublicId: string | null = null
      const oldPublicId = courseForm.image_public_id

      // Handle image removal
      if (removeCourseImage) {
        // Delete from Cloudinary
        if (oldPublicId) {
          await deleteImageFromCloudinary(oldPublicId)
        }
        imageUrl = null
        imagePublicId = null
      }
      // If editing and no new image selected, keep existing image
      else if (!courseImageFile && courseForm.image_url) {
        imageUrl = courseForm.image_url
        imagePublicId = courseForm.image_public_id
      }
      // Upload new image if file was selected
      else if (courseImageFile) {
        try {
          const uploadResult = await uploadImageToCloudinary(courseImageFile)
          imageUrl = uploadResult.image_url || null
          imagePublicId = uploadResult.image_public_id || null
          // Delete old image from Cloudinary if it exists
          if (oldPublicId) {
            await deleteImageFromCloudinary(oldPublicId)
          }
        } catch (err: any) {
          setLocalError(getErrorMessage(err) || 'Failed to upload course image')
          setIsCreatingCourse(false)
          return
        }
      }

      await dispatch(updateCourse({
        id: editingCourseId,
        data: {
          title: title,
          subject: subject,
          grade: grade,
          course_type: courseForm.course_type,
          image_url: imageUrl,
          image_public_id: imagePublicId,
          price: price,
          description: finalDescription,
          stream_ids: stream_ids,
        }
      })).unwrap()

      closeEditModal()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to update course')
    } finally {
      setIsCreatingCourse(false)
    }
  }

  const handleDeleteCourse = async (course: AdminCourse) => {
    const confirmed = window.confirm(`Delete course "${course.title}"? All exams inside this course will also be deleted.`)
    if (!confirmed) return

    try {
      setLocalError('')
      // Delete image from Cloudinary if it exists
      if (course.image_public_id) {
        await deleteImageFromCloudinary(course.image_public_id)
      }
      await dispatch(deleteCourse(course.id)).unwrap()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to delete course')
    }
  }

  // Filtering Logic
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      // Search filter
      if (filterForm.search) {
        const q = filterForm.search.toLowerCase()
        const matchesSearch = 
          course.title.toLowerCase().includes(q) || 
          course.subject.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }

      // Grade filter
      if (filterForm.grade !== 'all') {
        if (course.grade !== Number(filterForm.grade)) return false
      }

      // Stream filter
      if (filterForm.stream_id !== 'all') {
        if (!course.stream_ids?.includes(filterForm.stream_id)) return false
      }

      // Type filter
      if (course.course_type !== activeType) return false

      return true
    })
  }, [courses, filterForm, activeType])

  const clearFilters = () => {
    setFilterForm({
      search: '',
      grade: 'all',
      stream_id: 'all'
    })
  }


  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-lg font-semibold">Loading admin panel...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Course & Exam Management</h1>
            <p className="text-xs text-gray-500">Create grade-wise courses and exams</p>
          </div>
          <Link href="/admin/dashboard" className="px-4 py-2 text-sm text-teal-700 hover:bg-teal-50 rounded-lg">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && !showCreateModal && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Course Management</h2>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
          >
            + Create Course
          </button>
        </div>

        {/* Course Type Tabs */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveType('exam')}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeType === 'exam'
                  ? 'bg-blue-50 text-blue-700 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 border-transparent bg-white'
              }`}
            >
              Paper Classes (Exams)
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${
                activeType === 'exam' ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {courses.filter(c => c.course_type === 'exam').length}
              </span>
            </button>
            <button
              onClick={() => setActiveType('video')}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeType === 'video'
                  ? 'bg-purple-50 text-purple-700 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700 border-transparent bg-white'
              }`}
            >
              Video Classes
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${
                activeType === 'video' ? 'bg-purple-200 text-purple-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {courses.filter(c => c.course_type === 'video').length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 border border-gray-200 rounded-xl shadow-sm">
          <div className="flex-1 w-full relative">
            <input
              type="text"
              placeholder="Search by title or subject..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition-all"
              value={filterForm.search}
              onChange={(e) => setFilterForm(prev => ({ ...prev, search: e.target.value }))}
            />
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              className="flex-1 md:w-32 py-2 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              value={filterForm.grade}
              onChange={(e) => setFilterForm(prev => ({ ...prev, grade: e.target.value }))}
            >
              <option value="all">All Grades</option>
              {[5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>

            <select
              className="flex-1 md:w-48 py-2 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              value={filterForm.stream_id}
              onChange={(e) => setFilterForm(prev => ({ ...prev, stream_id: e.target.value }))}
            >
              <option value="all">All Streams</option>
              {streams.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {(filterForm.search || filterForm.grade !== 'all' || filterForm.stream_id !== 'all') && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          {loadingData ? (
            <p className="text-sm text-gray-500">Loading data...</p>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">{courses.length === 0 ? 'No courses yet' : 'No courses match your filters'}</p>
              {courses.length === 0 ? (
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Create your first course
                </button>
              ) : (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((course) => (
                <div key={course.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {course.image_url && (
                    <img
                      src={course.image_url}
                      alt={course.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{course.title}</h3>
                      <div className="text-xs text-gray-600 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mr-2 ${course.course_type === 'video' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {course.course_type === 'video' ? 'Video Class' : 'Paper Class'}
                        </span>
                        Grade {course.grade} • {course.subject}
                        {course.stream_ids && course.stream_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {course.stream_ids.map(sid => (
                              <span key={sid} className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-[10px] font-medium border border-teal-100">
                                {streams.find(s => s.id === sid)?.name || 'Stream'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {course.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{course.description}</p>
                    )}
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-teal-700">{course.price === 0 ? 'Free' : `LKR ${course.price.toLocaleString()}`}</p>
                    </div>
                    <div className="space-y-2">
                      <Link
                        href={course.course_type === 'video' ? `/admin/courses/${course.id}/video-modules` : `/admin/courses/${course.id}/sub-courses`}
                        className={`block w-full text-center px-3 py-2 text-xs rounded-md font-medium transition-colors ${course.course_type === 'video' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-teal-100 text-teal-700 hover:bg-teal-200'}`}
                      >
                        {course.course_type === 'video' ? 'Manage Video Modules' : 'Manage Modules'}
                      </Link>
                      <button 
                        onClick={() => setSelectedForAccess({ id: course.id, title: course.title })}
                        className="block w-full px-3 py-2 text-xs rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 text-center font-bold uppercase tracking-wider transition-colors"
                      >
                        Manage Access
                      </button>
                      <button 
                        onClick={() => setAnalyzingCourse({ id: course.id, title: course.title })}
                        className="block w-full px-3 py-2 text-xs rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-center font-bold uppercase tracking-wider transition-colors"
                      >
                        Performance Analysis
                      </button>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 px-2 py-2 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                          onClick={() => openEditModal(course)}
                        >
                          Edit
                        </button>
                        <button
                          className="flex-1 px-2 py-2 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                          onClick={() => handleDeleteCourse(course)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Create Course</h2>
              <button
                onClick={closeCreateModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Course title"
                value={courseForm.title}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={courseForm.grade}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, grade: Number(e.target.value), subject: '' }))}
              >
                {[5, 6, 7, 8, 9, 10, 11, 12, 13].map((grade) => (
                  <option key={grade} value={grade}>Grade {grade}</option>
                ))}
              </select>
              {loadingSubjects ? (
                <div className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-400 animate-pulse">
                  Loading subjects for Grade {courseForm.grade}…
                </div>
              ) : gradeSubjects.length === 0 ? (
                <div className="w-full border border-amber-200 rounded-lg px-3 py-2 bg-amber-50 text-sm text-amber-700 flex items-center justify-between gap-2">
                  <span>No subjects for Grade {courseForm.grade}.</span>
                  <a href="/admin/streams" target="_blank" rel="noreferrer" className="underline font-semibold text-amber-800 whitespace-nowrap">
                    Add subjects →
                  </a>
                </div>
              ) : (
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  value={courseForm.subject}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, subject: e.target.value }))}
                  required
                >
                  <option value="">Select subject…</option>
                  {gradeSubjects.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-teal-700">Course Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="course_type"
                      value="exam"
                      checked={courseForm.course_type === 'exam'}
                      onChange={(e) => setCourseForm(prev => ({ ...prev, course_type: 'exam' }))}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Paper Class (Exams)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="course_type"
                      value="video"
                      checked={courseForm.course_type === 'video'}
                      onChange={(e) => setCourseForm(prev => ({ ...prev, course_type: 'video' }))}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Video Class</span>
                  </label>
                </div>
              </div>

              {courseForm.grade >= 12 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-teal-700">Educational Streams</label>
                  <div className="grid grid-cols-2 gap-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                    {streams.filter(s => s.is_active).map((stream) => (
                      <label key={stream.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1.5 rounded-md transition-all border border-transparent hover:border-teal-100 group">
                        <input
                          type="checkbox"
                          checked={courseForm.stream_ids.includes(stream.id)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setCourseForm(prev => ({
                              ...prev,
                              stream_ids: checked 
                                ? [...prev.stream_ids, stream.id]
                                : prev.stream_ids.filter(id => id !== stream.id)
                            }))
                          }}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                        />
                        <span className="text-gray-700 group-hover:text-teal-700 transition-colors font-medium">{stream.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 italic">Select one or more streams for this course</p>
                </div>
              )}
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Description (optional)"
                value={courseForm.description}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Course Image (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  onChange={(e) => setCourseImageFile(e.target.files?.[0] || null)}
                />
                {courseImageFile && (
                  <p className="text-xs text-gray-600">Selected: {courseImageFile.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (LKR)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={courseForm.price}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, price: e.target.value }))}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCourse}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {isCreatingCourse ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Edit Course</h2>
              <button
                onClick={closeEditModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditCourse} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Course title"
                value={courseForm.title}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={courseForm.grade}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, grade: Number(e.target.value), subject: '' }))}
              >
                {[5, 6, 7, 8, 9, 10, 11, 12, 13].map((grade) => (
                  <option key={grade} value={grade}>Grade {grade}</option>
                ))}
              </select>
              {loadingSubjects ? (
                <div className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-400 animate-pulse">
                  Loading subjects for Grade {courseForm.grade}…
                </div>
              ) : gradeSubjects.length === 0 ? (
                <div className="w-full border border-amber-200 rounded-lg px-3 py-2 bg-amber-50 text-sm text-amber-700 flex items-center justify-between gap-2">
                  <span>No subjects for Grade {courseForm.grade}.</span>
                  <a href="/admin/streams" target="_blank" rel="noreferrer" className="underline font-semibold text-amber-800 whitespace-nowrap">
                    Add subjects →
                  </a>
                </div>
              ) : (
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  value={courseForm.subject}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, subject: e.target.value }))}
                  required
                >
                  <option value="">Select subject…</option>
                  {gradeSubjects.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-teal-700">Course Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer opacity-70">
                    <input
                      type="radio"
                      name="course_type_edit"
                      value="exam"
                      disabled
                      checked={courseForm.course_type === 'exam'}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Paper Class (Exams)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer opacity-70">
                    <input
                      type="radio"
                      name="course_type_edit"
                      value="video"
                      disabled
                      checked={courseForm.course_type === 'video'}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Video Class</span>
                  </label>
                </div>
                <p className="text-[10px] text-gray-400 italic">Course type cannot be changed after creation</p>
              </div>

              {courseForm.grade >= 12 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-teal-700">Educational Streams</label>
                  <div className="grid grid-cols-2 gap-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                    {streams.filter(s => s.is_active).map((stream) => (
                      <label key={stream.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1.5 rounded-md transition-all border border-transparent hover:border-teal-100 group">
                        <input
                          type="checkbox"
                          checked={courseForm.stream_ids.includes(stream.id)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setCourseForm(prev => ({
                              ...prev,
                              stream_ids: checked 
                                ? [...prev.stream_ids, stream.id]
                                : prev.stream_ids.filter(id => id !== stream.id)
                            }))
                          }}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                        />
                        <span className="text-gray-700 group-hover:text-teal-700 transition-colors font-medium">{stream.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 italic">Select one or more streams for this course</p>
                </div>
              )}
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Description (optional)"
                value={courseForm.description}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Course Image</label>
                {courseForm.image_url && !courseImageFile && !removeCourseImage && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <img src={courseForm.image_url} alt="Current course" className="w-24 h-16 rounded object-cover border border-gray-200" />
                        <span className="text-xs text-gray-600">Current image</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRemoveCourseImage(true)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove Image
                      </button>
                    </div>
                  </div>
                )}
                {removeCourseImage && (
                  <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-red-700">Image will be removed when you save</p>
                      <button
                        type="button"
                        onClick={() => setRemoveCourseImage(false)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Undo
                      </button>
                    </div>
                  </div>
                )}
                {!removeCourseImage && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      onChange={(e) => setCourseImageFile(e.target.files?.[0] || null)}
                    />
                    {courseImageFile && (
                      <p className="text-xs text-gray-600">Selected: {courseImageFile.name} (will replace current image)</p>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (LKR)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={courseForm.price}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, price: e.target.value }))}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCourse}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {isCreatingCourse ? 'Updating...' : 'Update Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Access Management Modal */}
      {selectedForAccess && (
        <EnrollmentAccessModal
          type="course"
          id={selectedForAccess.id}
          title={selectedForAccess.title}
          onClose={() => setSelectedForAccess(null)}
        />
      )}

      {/* Performance Analysis Modal */}
      {analyzingCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-indigo-100 animate-in zoom-in-95 duration-300">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Struggle Analysis</h2>
                <p className="text-xs text-indigo-100">Analyzing first-attempt performance for: {analyzingCourse.title}</p>
              </div>
              <button
                onClick={() => setAnalyzingCourse(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors border border-white/20"
              >
                <X className="w-5 h-5" />
                <span className="sr-only">Close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              <PerformanceAnalysis 
                courseId={analyzingCourse.id} 
                courseTitle={analyzingCourse.title} 
              />
            </div>
            
            <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setAnalyzingCourse(null)}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
