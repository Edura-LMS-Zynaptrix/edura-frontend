'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchCourses } from '@/lib/redux/slices/coursesSlice'
import { fetchExams, createExam, updateExam, deleteExam } from '@/lib/redux/slices/examsSlice'
import { uploadImageThunk, deleteImageThunk } from '@/lib/redux/slices/coursesSlice'
import { getErrorMessage } from '@/lib/utils'
import { bulkImportExams, downloadBulkImportTemplate, BulkImportResult } from '@/lib/api/admin'

type Course = {
  id: string
  title: string
  subject: string
  grade: number
  image_url: string
  image_public_id?: string
  price: number
  description?: string
  sub_courses?: { id: string, title: string }[]
}

type Exam = {
  id: string
  course_id: string
  sub_course_id: string
  title: string
  image_url: string | null
  image_public_id?: string | null
  description?: string | null
  duration_minutes: number
  total_questions: number
  order_number: number
  scheduled_start?: string | null
}

export default function CourseExamsPage() {
  const params = useParams<{ courseId: string; subCourseId: string }>()
  const { courseId, subCourseId } = params
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth)
  const { courses } = useAppSelector((state) => state.courses)
  const { exams: allExams, isLoading: loadingData, error: storeError } = useAppSelector((state) => state.exams)
  
  const exams = useMemo(() => {
    return allExams
      .filter((e) => e.course_id === courseId && e.sub_course_id === subCourseId)
      .sort((a, b) => (a.order_number || 0) - (b.order_number || 0))
  }, [allExams, courseId, subCourseId])

  const [localError, setLocalError] = useState('')
  const [examImageFile, setExamImageFile] = useState<File | null>(null)
  const [removeExamImage, setRemoveExamImage] = useState(false)
  const [isCreatingExam, setIsCreatingExam] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingExamId, setEditingExamId] = useState<string | null>(null)

  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null)
  const [isBulkImporting, setIsBulkImporting] = useState(false)
  const [bulkImportResult, setBulkImportResult] = useState<BulkImportResult | null>(null)
  const [bulkImportError, setBulkImportError] = useState('')

  const [examForm, setExamForm] = useState({
    title: '',
    image_url: '',
    image_public_id: '',
    description: '',
    duration_hours: '',
    duration_minutes: '',
    total_questions: '',
    order_number: '0',
    scheduled_start: '',
  })

  const error = storeError || localError
  const course = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId])
  const subCourse = useMemo(() => course?.sub_courses?.find(sc => sc.id === subCourseId), [course, subCourseId])

  const uploadImageToCloudinary = async (file: File) => {
    const resultAction = await dispatch(uploadImageThunk({ file, entity: 'exams' }))
    if (uploadImageThunk.fulfilled.match(resultAction)) {
      return {
        image_url: resultAction.payload.image_url,
        image_public_id: resultAction.payload.image_public_id,
      }
    } else {
      throw new Error(resultAction.payload as string || 'Image upload failed')
    }
  }

  const deleteImageFromCloudinary = async (publicId: string | null | undefined) => {
    if (!publicId) return
    try {
      await dispatch(deleteImageThunk(publicId))
    } catch (err: any) {
      console.error('Failed to delete image from Cloudinary:', err)
    }
  }

  const pageTitle = useMemo(() => {
    if (!subCourse) return 'Manage Exams'
    return `Manage Exams • ${subCourse.title}`
  }, [subCourse])

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
      if (courses.length === 0) {
        dispatch(fetchCourses())
      }
      dispatch(fetchExams(courseId))
    }
  }, [isInitialized, isAuthenticated, user, dispatch, router, courseId, courses.length, pathname, isLoading, searchParams])

  const validateExamForm = (): { title: string; totalDurationMinutes: number; totalQuestions: number; orderNumber: number; finalDescription: string | null } | null => {
    const title = examForm.title ? examForm.title.trim() : ''
    if (!title) { setLocalError('Please enter exam title'); return null }

    if (!examForm.duration_hours && !examForm.duration_minutes) {
      setLocalError('Please enter exam duration (hours and/or minutes)'); return null
    }

    if (!examForm.total_questions) { setLocalError('Please enter total questions'); return null }

    const hours = Number(examForm.duration_hours) || 0
    const minutes = Number(examForm.duration_minutes) || 0
    if (isNaN(hours) || isNaN(minutes)) { setLocalError('Please enter valid hours and minutes'); return null }

    const totalDurationMinutes = hours * 60 + minutes
    if (totalDurationMinutes < 1 || totalDurationMinutes > 480) {
      setLocalError('Duration must be between 1 minute and 8 hours'); return null
    }

    const totalQuestions = Number(examForm.total_questions)
    if (isNaN(totalQuestions) || totalQuestions < 0) { setLocalError('Please enter a valid number of questions'); return null }

    const orderNumber = Number(examForm.order_number) || 0
    if (isNaN(orderNumber)) { setLocalError('Please enter a valid order number'); return null }

    const description = examForm.description ? examForm.description.trim() : null
    const finalDescription = description && description.length > 0 ? description : null

    return { title, totalDurationMinutes, totalQuestions, orderNumber, finalDescription }
  }

  const handleCreateExam = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setLocalError('')
      setIsCreatingExam(true)

      const validated = validateExamForm()
      if (!validated) { setIsCreatingExam(false); return }
      const { title, totalDurationMinutes, totalQuestions, orderNumber, finalDescription } = validated

      let imageUrl: string | null = null
      let imagePublicId: string | null = null

      if (examImageFile) {
        try {
          const uploadResult = await uploadImageToCloudinary(examImageFile)
          imageUrl = uploadResult.image_url || null
          imagePublicId = uploadResult.image_public_id || null
        } catch (err: any) {
          setLocalError(getErrorMessage(err) || 'Failed to upload exam image')
          setIsCreatingExam(false)
          return
        }
      }

      if (!courseId || !subCourseId) {
        setLocalError('Course ID or SubCourse ID is missing')
        setIsCreatingExam(false)
        return
      }

      await dispatch(createExam({
        course_id: String(courseId),
        sub_course_id: String(subCourseId),
        title: title,
        image_url: imageUrl,
        image_public_id: imagePublicId,
        description: finalDescription,
        duration_minutes: totalDurationMinutes,
        total_questions: Math.floor(totalQuestions),
        order_number: Math.floor(orderNumber),
        scheduled_start: examForm.scheduled_start ? new Date(examForm.scheduled_start).toISOString() : null,
      })).unwrap()

      setExamForm({
        title: '',
        image_url: '',
        image_public_id: '',
        description: '',
        duration_hours: '',
        duration_minutes: '',
        total_questions: '',
        order_number: '0',
        scheduled_start: '',
      })
      setExamImageFile(null)
      setShowCreateModal(false)
      setLocalError('')
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to create exam')
    } finally {
      setIsCreatingExam(false)
    }
  }

  const openCreateModal = () => {
    setLocalError('')
    setExamForm({
      title: '',
      image_url: '',
      image_public_id: '',
      description: '',
      duration_hours: '',
      duration_minutes: '',
      total_questions: '',
      order_number: String(exams.length + 1),
      scheduled_start: '',
    })
    setExamImageFile(null)
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setLocalError('')
    setExamImageFile(null)
  }

  const openBulkImportModal = () => {
    setBulkImportFile(null)
    setBulkImportResult(null)
    setBulkImportError('')
    setShowBulkImportModal(true)
  }

  const closeBulkImportModal = () => {
    if (isBulkImporting) return
    setShowBulkImportModal(false)
    setBulkImportFile(null)
    setBulkImportResult(null)
    setBulkImportError('')
  }

  const handleBulkImport = async () => {
    if (!bulkImportFile) { setBulkImportError('Please select a ZIP file'); return }
    try {
      setBulkImportError('')
      setIsBulkImporting(true)
      const result = await bulkImportExams(courseId, subCourseId, bulkImportFile)
      setBulkImportResult(result)
      if (result.created_exams > 0) {
        dispatch(fetchExams(courseId))
      }
    } catch (err: any) {
      setBulkImportError(getErrorMessage(err) || 'Bulk import failed')
    } finally {
      setIsBulkImporting(false)
    }
  }

  const openEditModal = (exam: Exam) => {
    setLocalError('')
    const hours = Math.floor(exam.duration_minutes / 60)
    const minutes = exam.duration_minutes % 60
    const scheduledLocal = exam.scheduled_start
      ? new Date(exam.scheduled_start).toISOString().slice(0, 16)
      : ''
    setExamForm({
      title: exam.title,
      image_url: exam.image_url || '',
      image_public_id: exam.image_public_id || '',
      description: exam.description || '',
      duration_hours: hours > 0 ? String(hours) : '',
      duration_minutes: minutes > 0 ? String(minutes) : '',
      total_questions: String(exam.total_questions),
      order_number: String(exam.order_number || 0),
      scheduled_start: scheduledLocal,
    })
    setExamImageFile(null)
    setRemoveExamImage(false)
    setEditingExamId(exam.id)
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setLocalError('')
    setExamImageFile(null)
    setRemoveExamImage(false)
    setEditingExamId(null)
  }

  const handleEditExam = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingExamId) return

    try {
      setLocalError('')
      setIsCreatingExam(true)

      const validated = validateExamForm()
      if (!validated) { setIsCreatingExam(false); return }
      const { title, totalDurationMinutes, totalQuestions, orderNumber, finalDescription } = validated

      let imageUrl: string | null = null
      let imagePublicId: string | null = null
      const oldPublicId = examForm.image_public_id

      if (removeExamImage) {
        if (oldPublicId) {
          await deleteImageFromCloudinary(oldPublicId)
        }
        imageUrl = null
        imagePublicId = null
      }
      else if (!examImageFile && examForm.image_url) {
        imageUrl = examForm.image_url
        imagePublicId = examForm.image_public_id
      }
      else if (examImageFile) {
        try {
          const uploadResult = await uploadImageToCloudinary(examImageFile)
          imageUrl = uploadResult.image_url || null
          imagePublicId = uploadResult.image_public_id || null
          if (oldPublicId) {
            await deleteImageFromCloudinary(oldPublicId)
          }
        } catch (err: any) {
          setLocalError(getErrorMessage(err) || 'Failed to upload exam image')
          setIsCreatingExam(false)
          return
        }
      }

      await dispatch(updateExam({
        id: editingExamId,
        data: {
          title: title,
          image_url: imageUrl,
          image_public_id: imagePublicId,
          description: finalDescription,
          duration_minutes: totalDurationMinutes,
          total_questions: Math.floor(totalQuestions),
          order_number: Math.floor(orderNumber),
          scheduled_start: examForm.scheduled_start ? new Date(examForm.scheduled_start).toISOString() : null,
        }
      })).unwrap()

      closeEditModal()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to update exam')
    } finally {
      setIsCreatingExam(false)
    }
  }

  const handleDeleteExam = async (exam: Exam) => {
    const confirmed = window.confirm(`Delete exam "${exam.title}"?`)
    if (!confirmed) return

    try {
      setLocalError('')
      if (exam.image_public_id) {
        await deleteImageFromCloudinary(exam.image_public_id)
      }
      await dispatch(deleteExam(exam.id)).unwrap()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to delete exam')
    }
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
            <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
            {course && (
              <p className="text-xs text-gray-500">Grade {course.grade} • {course.subject} • {course.price === 0 ? 'Free' : `LKR ${course.price.toLocaleString()}`}</p>
            )}
          </div>
          <Link href={`/admin/courses/${courseId}/sub-courses`} className="px-4 py-2 text-sm text-teal-700 hover:bg-teal-50 rounded-lg">
            Back to Modules
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && !showCreateModal && !showEditModal && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Exams</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={openBulkImportModal}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              Bulk Import
            </button>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium"
            >
              + Create Exam
            </button>
          </div>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          {loadingData ? (
            <p className="text-sm text-gray-500">Loading data...</p>
          ) : exams.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No exams yet in this course</p>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black"
              >
                Create your first exam
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.map((exam) => (
                <div key={exam.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {exam.image_url && (
                    <img
                      src={exam.image_url}
                      alt={exam.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{exam.title}</h3>
                      <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200">
                        #{exam.order_number}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-3 space-y-1">
                      <p>Duration: {exam.duration_minutes} minutes</p>
                      <p>Questions: {exam.total_questions}</p>
                      {exam.scheduled_start ? (
                        <p className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="text-xs">
                            Starts: {new Date(exam.scheduled_start).toLocaleString()}
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs text-green-600 font-medium">Available Anytime</p>
                      )}
                    </div>
                    {exam.description && (
                      <p className="text-xs text-gray-600 mb-4 line-clamp-2">{exam.description}</p>
                    )}
                    <div className="space-y-2">
                      <Link 
                        href={`/admin/courses/${courseId}/sub-courses/${subCourseId}/exams/${exam.id}/questions`}
                        className="block w-full px-3 py-2 text-xs rounded-md bg-teal-100 text-teal-700 hover:bg-teal-200 text-center font-medium"
                      >
                        Manage Questions
                      </Link>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 px-2 py-2 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                          onClick={() => openEditModal(exam)}
                        >
                          Edit
                        </button>
                        <button
                          className="flex-1 px-2 py-2 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                          onClick={() => handleDeleteExam(exam)}
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

      {/* Create Exam Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Create Exam</h2>
              <button
                onClick={closeCreateModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Exam title"
                value={examForm.title}
                onChange={(e) => setExamForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Description (optional)"
                value={examForm.description}
                onChange={(e) => setExamForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Exam Image (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  onChange={(e) => setExamImageFile(e.target.files?.[0] || null)}
                />
                {examImageFile && (
                  <p className="text-xs text-gray-600">Selected: {examImageFile.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Duration</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Hours"
                      value={examForm.duration_hours}
                      onChange={(e) => setExamForm((prev) => ({ ...prev, duration_hours: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Hours</p>
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Minutes"
                      value={examForm.duration_minutes}
                      onChange={(e) => setExamForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Minutes</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Total Questions</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter total number of questions"
                  value={examForm.total_questions}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, total_questions: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Order Number</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter order number"
                  value={examForm.order_number}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, order_number: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Exam Start Date & Time</label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={examForm.scheduled_start}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, scheduled_start: e.target.value }))}
                />
                <p className="text-xs text-gray-500">Leave empty to allow students to start anytime</p>
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
                  disabled={isCreatingExam}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
                >
                  {isCreatingExam ? 'Creating...' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Exam Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Edit Exam</h2>
              <button
                onClick={closeEditModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditExam} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Exam title"
                value={examForm.title}
                onChange={(e) => setExamForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Description (optional)"
                value={examForm.description}
                onChange={(e) => setExamForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Exam Image</label>
                {examForm.image_url && !examImageFile && !removeExamImage && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <img src={examForm.image_url} alt="Current exam" className="w-24 h-16 rounded object-cover border border-gray-200" />
                        <span className="text-xs text-gray-600">Current image</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRemoveExamImage(true)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove Image
                      </button>
                    </div>
                  </div>
                )}
                {removeExamImage && (
                  <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-red-700">Image will be removed when you save</p>
                      <button
                        type="button"
                        onClick={() => setRemoveExamImage(false)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Undo
                      </button>
                    </div>
                  </div>
                )}
                {!removeExamImage && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      onChange={(e) => setExamImageFile(e.target.files?.[0] || null)}
                    />
                    {examImageFile && (
                      <p className="text-xs text-gray-600">Selected: {examImageFile.name} (will replace current image)</p>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Duration</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Hours"
                      value={examForm.duration_hours}
                      onChange={(e) => setExamForm((prev) => ({ ...prev, duration_hours: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Hours</p>
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Minutes"
                      value={examForm.duration_minutes}
                      onChange={(e) => setExamForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Minutes</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Total Questions</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter total number of questions"
                  value={examForm.total_questions}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, total_questions: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Order Number</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter order number"
                  value={examForm.order_number}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, order_number: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Exam Start Date & Time</label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={examForm.scheduled_start}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, scheduled_start: e.target.value }))}
                />
                <p className="text-xs text-gray-500">Leave empty to allow students to start anytime</p>
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
                  disabled={isCreatingExam}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
                >
                  {isCreatingExam ? 'Updating...' : 'Update Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Bulk Import Exams</h2>
              <button onClick={closeBulkImportModal} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Template download */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900">First time? Download the template</p>
                  <p className="text-xs text-blue-700 mt-1">
                    The template ZIP contains a README, sample <code>exams.csv</code>, and sample <code>questions.csv</code> files with all required columns.
                  </p>
                </div>
                <button
                  onClick={() => downloadBulkImportTemplate().catch(console.error)}
                  className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
                >
                  Download Template
                </button>
              </div>

              {/* ZIP upload */}
              {!bulkImportResult && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Upload ZIP Bundle</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      className="hidden"
                      id="bulk-import-zip"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        setBulkImportFile(f)
                        setBulkImportError('')
                      }}
                    />
                    <label htmlFor="bulk-import-zip" className="cursor-pointer">
                      {bulkImportFile ? (
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{bulkImportFile.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{(bulkImportFile.size / 1024 / 1024).toFixed(1)} MB — click to change</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-600">Click to select a <strong>.zip</strong> file</p>
                          <p className="text-xs text-gray-400 mt-1">Max 200 MB</p>
                        </div>
                      )}
                    </label>
                  </div>

                  {bulkImportError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{bulkImportError}</p>
                  )}
                </div>
              )}

              {/* Result summary */}
              {bulkImportResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                      <p className="text-2xl font-black text-green-700">{bulkImportResult.created_exams}</p>
                      <p className="text-xs text-green-600 font-semibold mt-1">Exams Created</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                      <p className="text-2xl font-black text-blue-700">{bulkImportResult.total_questions_created}</p>
                      <p className="text-xs text-blue-600 font-semibold mt-1">Questions Imported</p>
                    </div>
                    <div className={`border rounded-lg p-3 text-center ${bulkImportResult.skipped_exams > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                      <p className={`text-2xl font-black ${bulkImportResult.skipped_exams > 0 ? 'text-red-700' : 'text-gray-400'}`}>{bulkImportResult.skipped_exams}</p>
                      <p className={`text-xs font-semibold mt-1 ${bulkImportResult.skipped_exams > 0 ? 'text-red-600' : 'text-gray-400'}`}>Skipped</p>
                    </div>
                  </div>

                  {bulkImportResult.details.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">Created Exams</p>
                      {bulkImportResult.details.map((d) => (
                        <div key={d.exam_id} className="bg-gray-50 rounded-lg px-4 py-2 text-sm">
                          <span className="font-semibold text-gray-900">{d.title}</span>
                          <span className="text-gray-500 ml-2">({d.questions_created} questions, {d.images_applied} images)</span>
                          {d.warnings && d.warnings.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {d.warnings.map((w, i) => (
                                <li key={i} className="text-xs text-amber-700">&bull; {w}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {bulkImportResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-red-700">Errors</p>
                      {bulkImportResult.errors.map((e, i) => (
                        <div key={i} className="bg-red-50 rounded-lg px-4 py-2 text-sm text-red-800">
                          <span className="font-semibold">{e.exam}:</span> {e.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t border-gray-200">
                <button
                  onClick={closeBulkImportModal}
                  disabled={isBulkImporting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {bulkImportResult ? 'Close' : 'Cancel'}
                </button>
                {!bulkImportResult && (
                  <button
                    onClick={handleBulkImport}
                    disabled={isBulkImporting || !bulkImportFile}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50 font-medium"
                  >
                    {isBulkImporting ? 'Importing...' : 'Import Exams'}
                  </button>
                )}
                {bulkImportResult && (
                  <button
                    onClick={() => { setBulkImportResult(null); setBulkImportFile(null) }}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium"
                  >
                    Import Another
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
