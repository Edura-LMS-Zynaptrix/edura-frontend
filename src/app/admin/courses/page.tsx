'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchCourses, createCourse, updateCourse, deleteCourse, AdminCourse, uploadImageThunk } from '@/lib/redux/slices/coursesSlice'
import { getErrorMessage } from '@/lib/utils'

export default function AdminCoursesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth)
  const { courses, isLoading: loadingData, error: storeError } = useAppSelector((state) => state.courses)

  const [localError, setLocalError] = useState('')
  const [courseImageFile, setCourseImageFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    price: '0',
    image_url: '',
    image_public_id: '',
  })

  const error = storeError || localError

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
    // course_service's list endpoint doesn't scope by instructor for the
    // teacher role, so this page — like the rest of /admin — stays admin-only
    // until that's addressed; teachers can still manage courses via the API.
    if (isAuthenticated && user && user.role !== 'admin') {
      router.push('/')
      return
    }
    if (isAuthenticated && user) {
      dispatch(fetchCourses())
    }
  }, [isAuthenticated, isInitialized, user, dispatch, router, pathname, isLoading, searchParams])

  const resetForm = () => setCourseForm({ title: '', description: '', price: '0', image_url: '', image_public_id: '' })

  const validateCourseForm = (): { title: string; price: number; description: string | null } | null => {
    const title = courseForm.title.trim()
    if (!title) { setLocalError('Please enter a course title'); return null }
    const price = courseForm.price === '' ? 0 : Number(courseForm.price)
    if (isNaN(price) || price < 0) { setLocalError('Please enter a valid price'); return null }
    const description = courseForm.description.trim() || null
    return { title, price, description }
  }

  // public_id is stored alongside the URL so the asset can be managed
  // (deleted, transformed) in Cloudinary later — the URL alone isn't enough.
  const uploadThumbnail = async (): Promise<{ url: string | null; publicId: string | null }> => {
    if (!courseImageFile) return { url: courseForm.image_url || null, publicId: courseForm.image_public_id || null }
    const resultAction = await dispatch(uploadImageThunk({ file: courseImageFile, entity: 'courses' }))
    if (uploadImageThunk.fulfilled.match(resultAction)) {
      return { url: resultAction.payload.image_url, publicId: resultAction.payload.image_public_id }
    }
    throw new Error((resultAction.payload as string) || 'Image upload failed')
  }

  const openCreateModal = () => {
    setLocalError('')
    resetForm()
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
      description: course.description || '',
      price: String(course.price),
      image_url: course.image_url || '',
      image_public_id: course.image_public_id || '',
    })
    setCourseImageFile(null)
    setEditingCourseId(course.id)
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setLocalError('')
    setCourseImageFile(null)
    setEditingCourseId(null)
  }

  const handleCreateCourse = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setLocalError('')
      setIsSaving(true)
      const validated = validateCourseForm()
      if (!validated) { setIsSaving(false); return }

      let imageUrl: string | null = null
      let imagePublicId: string | null = null
      try {
        const uploaded = await uploadThumbnail()
        imageUrl = uploaded.url
        imagePublicId = uploaded.publicId
      } catch (err: any) {
        setLocalError(getErrorMessage(err))
        setIsSaving(false)
        return
      }

      await dispatch(createCourse({
        title: validated.title,
        subject: '',
        grade: 0,
        course_type: 'video',
        price: validated.price,
        description: validated.description,
        image_url: imageUrl,
        image_public_id: imagePublicId,
      })).unwrap()

      resetForm()
      setCourseImageFile(null)
      setShowCreateModal(false)
    } catch (err: any) {
      setLocalError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditCourse = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingCourseId) return
    try {
      setLocalError('')
      setIsSaving(true)
      const validated = validateCourseForm()
      if (!validated) { setIsSaving(false); return }

      let imageUrl: string | null = courseForm.image_url || null
      let imagePublicId: string | null = courseForm.image_public_id || null
      if (courseImageFile) {
        try {
          const uploaded = await uploadThumbnail()
          imageUrl = uploaded.url
          imagePublicId = uploaded.publicId
        } catch (err: any) {
          setLocalError(getErrorMessage(err))
          setIsSaving(false)
          return
        }
      }

      await dispatch(updateCourse({
        id: editingCourseId,
        data: {
          title: validated.title,
          price: validated.price,
          description: validated.description,
          image_url: imageUrl,
          image_public_id: imagePublicId,
        },
      })).unwrap()

      closeEditModal()
    } catch (err: any) {
      setLocalError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleTogglePublish = async (course: AdminCourse) => {
    try {
      setLocalError('')
      await dispatch(updateCourse({
        id: course.id,
        data: { status: course.is_active ? 'DRAFT' : 'PUBLISHED' } as any,
      })).unwrap()
    } catch (err: any) {
      setLocalError(getErrorMessage(err))
    }
  }

  const handleDeleteCourse = async (course: AdminCourse) => {
    const confirmed = window.confirm(`Delete course "${course.title}"? All its modules and lessons will also be deleted.`)
    if (!confirmed) return
    try {
      setLocalError('')
      await dispatch(deleteCourse(course.id)).unwrap()
    } catch (err: any) {
      setLocalError(getErrorMessage(err))
    }
  }

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return courses
    return courses.filter((c: AdminCourse) => c.title.toLowerCase().includes(q))
  }, [courses, search])

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
            <h1 className="text-xl font-bold text-gray-900">Course Management</h1>
            <p className="text-xs text-gray-500">Create courses, manage modules and lessons</p>
          </div>
          <Link href="/admin/dashboard" className="px-4 py-2 text-sm text-teal-700 hover:bg-teal-50 rounded-lg">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && !showCreateModal && !showEditModal && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">All Courses</h2>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
          >
            + Create Course
          </button>
        </div>

        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-sm">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by title..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          {loadingData ? (
            <p className="text-sm text-gray-500">Loading data...</p>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">{courses.length === 0 ? 'No courses yet' : 'No courses match your search'}</p>
              {courses.length === 0 && (
                <button onClick={openCreateModal} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                  Create your first course
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((course: AdminCourse) => (
                <div key={course.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {course.image_url ? (
                    <img src={course.image_url} alt={course.title} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center text-4xl opacity-30">📘</div>
                  )}
                  <div className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{course.title}</h3>
                      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${course.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {course.is_active ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    {course.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{course.description}</p>
                    )}
                    <p className="text-sm font-semibold text-teal-700 mb-4">
                      {course.price === 0 ? 'Free' : `LKR ${course.price.toLocaleString()}`}
                    </p>
                    <div className="space-y-2">
                      <Link
                        href={`/admin/courses/${course.id}/video-modules`}
                        className="block w-full text-center px-3 py-2 text-xs rounded-md font-medium bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors"
                      >
                        Manage Modules & Lessons
                      </Link>
                      <Link
                        href={`/admin/courses/${course.id}/exams`}
                        className="block w-full text-center px-3 py-2 text-xs rounded-md font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                      >
                        Manage Exams
                      </Link>
                      <button
                        onClick={() => handleTogglePublish(course)}
                        className={`block w-full px-3 py-2 text-xs rounded-md font-bold uppercase tracking-wider transition-colors ${
                          course.is_active ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {course.is_active ? 'Unpublish' : 'Publish'}
                      </button>
                      <div className="flex gap-2">
                        <button className="flex-1 px-2 py-2 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={() => openEditModal(course)}>
                          Edit
                        </button>
                        <button className="flex-1 px-2 py-2 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200" onClick={() => handleDeleteCourse(course)}>
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
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Create Course</h2>
              <button onClick={closeCreateModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleCreateCourse} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Course title"
                value={courseForm.title}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Description (optional)"
                value={courseForm.description}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Course Thumbnail (Optional)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  onChange={(e) => setCourseImageFile(e.target.files?.[0] || null)}
                />
                {courseImageFile && <p className="text-xs text-gray-600">Selected: {courseImageFile.name}</p>}
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
                <button type="button" onClick={closeCreateModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {isSaving ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Edit Course</h2>
              <button onClick={closeEditModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleEditCourse} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Course title"
                value={courseForm.title}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Description (optional)"
                value={courseForm.description}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Course Thumbnail</label>
                {courseForm.image_url && !courseImageFile && (
                  <img src={courseForm.image_url} alt="Current course" className="w-24 h-16 rounded object-cover border border-gray-200 mb-2" />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  onChange={(e) => setCourseImageFile(e.target.files?.[0] || null)}
                />
                {courseImageFile && <p className="text-xs text-gray-600">Selected: {courseImageFile.name} (will replace current image)</p>}
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
                <button type="button" onClick={closeEditModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {isSaving ? 'Updating...' : 'Update Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
