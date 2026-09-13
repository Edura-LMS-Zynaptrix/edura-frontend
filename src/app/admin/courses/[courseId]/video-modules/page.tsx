'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchCourses, uploadImageThunk, deleteImageThunk } from '@/lib/redux/slices/coursesSlice'
import { createModuleAction, clearVideoErrors } from '@/lib/redux/slices/videoClassesSlice'
import { getErrorMessage } from '@/lib/utils'
import EnrollmentAccessModal from '@/components/admin/EnrollmentAccessModal'
import * as adminApi from '@/lib/api/admin'

export default function CourseVideoModulesPage() {
  const params = useParams<{ courseId: string }>()
  const courseId = params.courseId
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  
  const { user, isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth)
  const { courses, isLoading: loadingData } = useAppSelector((state) => state.courses)
  const { adminLoading, adminError } = useAppSelector((state) => state.videoClasses)
  
  const course = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId])
  // Note: We'll need a way to fetch modules if they aren't in the course object already
  // For now, assume they are part of the course object or we fetch them
  const [modules, setModules] = useState<any[]>([])

  const [localError, setLocalError] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedForAccess, setSelectedForAccess] = useState<{ id: string, title: string } | null>(null)

  const [formConfig, setFormConfig] = useState({
    title: '',
    description: '',
    order_number: '0',
    is_active: true,
    image_url: '',
    image_public_id: ''
  })

  const error = adminError || localError

  useEffect(() => {
    if (courseId) {
      fetchModules()
    }
  }, [courseId])

  const fetchModules = async () => {
    try {
      const data = await adminApi.getModulesForCourse(courseId)
      setModules(data)
    } catch (err) {
      console.error('Failed to fetch modules:', err)
    }
  }

  const uploadImageToCloudinary = async (file: File) => {
    const resultAction = await dispatch(uploadImageThunk({ file, entity: 'courses' }))
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
    if (!course) return 'Manage Video Modules'
    return `Manage Video Modules • ${course.title}`
  }, [course])

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

    if (isAuthenticated && user && courses.length === 0) {
      dispatch(fetchCourses())
    }
  }, [isInitialized, isAuthenticated, user, dispatch, router, courses.length, pathname, isLoading, searchParams])

  const validateForm = (): { title: string; orderNumber: number; finalDescription: string | null } | null => {
    const title = formConfig.title ? formConfig.title.trim() : ''
    if (!title) { setLocalError('Please enter a title'); return null }

    const orderNumber = Number(formConfig.order_number) || 0
    const description = formConfig.description ? formConfig.description.trim() : null
    const finalDescription = description && description.length > 0 ? description : null

    return { title, orderNumber, finalDescription }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setLocalError('')
      setIsProcessing(true)

      const validated = validateForm()
      if (!validated) { setIsProcessing(false); return }
      const { title, orderNumber, finalDescription } = validated

      let imageUrl: string | null = null
      let imagePublicId: string | null = null

      if (imageFile) {
        try {
          const uploadResult = await uploadImageToCloudinary(imageFile)
          imageUrl = uploadResult.image_url || null
          imagePublicId = uploadResult.image_public_id || null
        } catch (err: any) {
          setLocalError(getErrorMessage(err) || 'Failed to upload image')
          setIsProcessing(false)
          return
        }
      }

      if (!courseId) {
        setLocalError('Course ID is missing')
        setIsProcessing(false)
        return
      }

      await dispatch(createModuleAction({
        course_id: String(courseId),
        title: title,
        description: finalDescription,
        order_number: orderNumber,
        is_active: formConfig.is_active,
        image_url: imageUrl,
        image_public_id: imagePublicId,
      })).unwrap()

      closeCreateModal()
      fetchModules()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to create module')
    } finally {
      setIsProcessing(false)
    }
  }

  const openCreateModal = () => {
    dispatch(clearVideoErrors())
    setLocalError('')
    setFormConfig({
      title: '',
      description: '',
      order_number: '0',
      is_active: true,
      image_url: '',
      image_public_id: ''
    })
    setImageFile(null)
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setLocalError('')
    setImageFile(null)
  }

  const openEditModal = (item: any) => {
    dispatch(clearVideoErrors())
    setLocalError('')
    setFormConfig({
      title: item.title,
      description: item.description || '',
      order_number: String(item.order_number || 0),
      is_active: item.is_active,
      image_url: item.image_url || '',
      image_public_id: item.image_public_id || ''
    })
    setImageFile(null)
    setRemoveImage(false)
    setEditingId(item.id)
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setLocalError('')
    setImageFile(null)
    setRemoveImage(false)
    setEditingId(null)
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingId) return

    try {
      setLocalError('')
      setIsProcessing(true)

      const validated = validateForm()
      if (!validated) { setIsProcessing(false); return }
      const { title, orderNumber, finalDescription } = validated

      let imageUrl: string | null = null
      let imagePublicId: string | null = null
      const oldPublicId = formConfig.image_public_id

      if (removeImage) {
        if (oldPublicId) await deleteImageFromCloudinary(oldPublicId)
        imageUrl = null
        imagePublicId = null
      } else if (!imageFile && formConfig.image_url) {
        imageUrl = formConfig.image_url
        imagePublicId = formConfig.image_public_id
      } else if (imageFile) {
        try {
          const uploadResult = await uploadImageToCloudinary(imageFile)
          imageUrl = uploadResult.image_url || null
          imagePublicId = uploadResult.image_public_id || null
          if (oldPublicId) await deleteImageFromCloudinary(oldPublicId)
        } catch (err: any) {
          setLocalError(getErrorMessage(err) || 'Failed to upload image')
          setIsProcessing(false)
          return
        }
      }

      await adminApi.updateModuleForCourse(courseId, editingId, {
        title: title,
        order_number: orderNumber,
      })

      closeEditModal()
      fetchModules()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to update module')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async (item: any) => {
    const confirmed = window.confirm(`Delete video module "${item.title}"? All videos and materials inside will also be deleted.`)
    if (!confirmed) return

    try {
      setLocalError('')
      await adminApi.deleteModuleForCourse(courseId, item.id)
      fetchModules()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to delete module')
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
            <h1 className="text-xl font-bold text-gray-900 font-outfit">{pageTitle}</h1>
            {course && (
              <p className="text-xs text-gray-500">Grade {course.grade} • {course.subject} • Video Class</p>
            )}
          </div>
          <Link href="/admin/courses" className="px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg transition-colors">
            Back to Courses
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && !showCreateModal && !showEditModal && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Video Modules</h2>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-sm transition-all"
          >
            + Create Module
          </button>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          {loadingData ? (
            <p className="text-sm text-gray-500">Loading data...</p>
          ) : modules.length === 0 ? (
            <div className="text-center py-12">
               <p className="text-gray-500 mb-4">No video modules yet in this course</p>
               <button onClick={openCreateModal} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                 Create your first Module
               </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.sort((a, b) => a.order_number - b.order_number).map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow border-t-4 border-t-purple-500">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.title} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2 font-outfit">{item.title}</h3>
                    <div className="text-xs text-gray-600 mb-3 space-y-1">
                      <p>Order: {item.order_number}</p>
                      <p>Status: {item.is_active ? <span className="text-green-600">Active</span> : <span className="text-gray-400">Inactive</span>}</p>
                    </div>
                    {item.description && <p className="text-xs text-gray-600 mb-4 line-clamp-2">{item.description}</p>}
                    <div className="space-y-2">
                      <Link 
                        href={`/admin/courses/${courseId}/video-modules/${item.id}/videos`}
                        className="block w-full px-3 py-2 text-xs rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 text-center font-medium transition-colors"
                      >
                        Manage Videos & Materials
                      </Link>
                      <button 
                        onClick={() => setSelectedForAccess({ id: item.id, title: item.title })}
                        className="block w-full px-3 py-2 text-xs rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 text-center font-bold uppercase tracking-wider transition-colors"
                      >
                        Manage Access
                      </button>
                      <div className="flex gap-2">
                        <button className="flex-1 px-2 py-2 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors" onClick={() => openEditModal(item)}>Edit</button>
                        <button className="flex-1 px-2 py-2 text-xs rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors" onClick={() => handleDelete(item)}>Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto font-outfit">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Create Video Module</h2>
              <button onClick={closeCreateModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Module Title</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. Unit 01 - Introduction" value={formConfig.title} onChange={(e) => setFormConfig({...formConfig, title: e.target.value})} required />
              </div>
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="What will students learn?" value={formConfig.description} onChange={(e) => setFormConfig({...formConfig, description: e.target.value})} rows={3} />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Order Number</label>
                  <input type="number" min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none" value={formConfig.order_number} onChange={(e) => setFormConfig({...formConfig, order_number: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Cover Image (Optional)</label>
                <input type="file" accept="image/*" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formConfig.is_active} onChange={(e) => setFormConfig({...formConfig, is_active: e.target.checked})} className="rounded text-purple-600 focus:ring-purple-500" />
                <span className="text-sm text-gray-700">Module is active and visible</span>
              </label>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={closeCreateModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isProcessing} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all font-bold shadow-md">
                  {isProcessing ? 'Creating...' : 'Create Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto font-outfit">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Edit Video Module</h2>
              <button onClick={closeEditModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Module Title</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Module Title" value={formConfig.title} onChange={(e) => setFormConfig({...formConfig, title: e.target.value})} required />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Description" value={formConfig.description} onChange={(e) => setFormConfig({...formConfig, description: e.target.value})} rows={3} />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Order Number</label>
                  <input type="number" min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none" value={formConfig.order_number} onChange={(e) => setFormConfig({...formConfig, order_number: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Image</label>
                {formConfig.image_url && !imageFile && !removeImage && (
                  <div className="flex items-center justify-between mb-3 p-2 border border-gray-200 rounded">
                    <img src={formConfig.image_url} alt="Current" className="h-12 w-16 object-cover rounded shadow-sm border" />
                    <button type="button" onClick={() => setRemoveImage(true)} className="text-xs text-red-600 font-medium whitespace-nowrap">Remove Image</button>
                  </div>
                )}
                {removeImage && (
                  <div className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded mb-3">
                    <span className="text-xs text-red-700">Selection: Image will be removed</span>
                    <button type="button" onClick={() => setRemoveImage(false)} className="text-xs font-medium text-red-700">Undo</button>
                  </div>
                )}
                {!removeImage && (
                  <input type="file" accept="image/*" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                )}
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formConfig.is_active} onChange={(e) => setFormConfig({...formConfig, is_active: e.target.checked})} className="rounded text-purple-600 focus:ring-purple-500" />
                <span className="text-sm text-gray-700">Module is visible to students</span>
              </label>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={closeEditModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isProcessing} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all font-bold shadow-md">
                  {isProcessing ? 'Updating...' : 'Update Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Access Management Modal */}
      {selectedForAccess && (
        <EnrollmentAccessModal
          type="module"
          id={selectedForAccess.id}
          title={selectedForAccess.title}
          onClose={() => setSelectedForAccess(null)}
        />
      )}
    </div>
  )
}
