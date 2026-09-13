'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchExams, createExam, updateExam, deleteExam } from '@/lib/redux/slices/examsSlice'
import { getErrorMessage } from '@/lib/utils'

export default function AdminCourseExamsPage() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const courseId = params?.courseId as string

  const { user, isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth)
  const { exams, isLoading: loadingExams, error: storeError } = useAppSelector((state) => state.exams)

  const [localError, setLocalError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingExamId, setEditingExamId] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    duration_minutes: '30',
    is_published: false,
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
    if (isAuthenticated && user && user.role !== 'admin') {
      router.push('/')
      return
    }
    if (isAuthenticated && user && courseId) {
      dispatch(fetchExams(courseId))
    }
  }, [isAuthenticated, isInitialized, user, dispatch, router, pathname, isLoading, searchParams, courseId])

  const resetForm = () => setForm({ title: '', description: '', duration_minutes: '30', is_published: false })

  const openCreateModal = () => {
    setLocalError('')
    resetForm()
    setShowCreateModal(true)
  }

  const openEditModal = (exam: any) => {
    setLocalError('')
    setForm({
      title: exam.title,
      description: exam.description || '',
      duration_minutes: String(exam.duration_minutes || 30),
      is_published: !!exam.is_published,
    })
    setEditingExamId(exam.id)
  }

  const closeModal = () => {
    setShowCreateModal(false)
    setEditingExamId(null)
    setLocalError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) { setLocalError('Please enter a title'); return }
    const duration = Number(form.duration_minutes)
    if (isNaN(duration) || duration <= 0) { setLocalError('Please enter a valid duration'); return }

    try {
      setLocalError('')
      setIsSaving(true)
      if (editingExamId) {
        await dispatch(updateExam({
          id: editingExamId,
          data: { title, description: form.description.trim() || null, duration_minutes: duration, is_published: form.is_published },
        })).unwrap()
      } else {
        await dispatch(createExam({
          course_id: courseId,
          title,
          description: form.description.trim() || null,
          duration_minutes: duration,
          total_questions: 0,
          price: 0,
          order_number: 0,
          is_published: form.is_published,
        })).unwrap()
      }
      closeModal()
    } catch (err: any) {
      setLocalError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (exam: any) => {
    if (!window.confirm(`Delete exam "${exam.title}"? All its questions will also be deleted.`)) return
    try {
      setLocalError('')
      await dispatch(deleteExam(exam.id)).unwrap()
    } catch (err: any) {
      setLocalError(getErrorMessage(err))
    }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-lg font-semibold">Loading admin panel...</div>
      </div>
    )
  }

  const modalOpen = showCreateModal || !!editingExamId

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Exam Management</h1>
            <p className="text-xs text-gray-500">Course #{courseId}</p>
          </div>
          <Link href="/admin/courses" className="px-4 py-2 text-sm text-teal-700 hover:bg-teal-50 rounded-lg">
            Back to Courses
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && !modalOpen && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Exams</h2>
          <button onClick={openCreateModal} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
            + Create Exam
          </button>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          {loadingExams ? (
            <p className="text-sm text-gray-500">Loading exams...</p>
          ) : exams.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No exams yet</p>
              <button onClick={openCreateModal} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                Create your first exam
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {exams.map((exam: any) => (
                <div key={exam.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{exam.title}</h3>
                      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${exam.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {exam.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    {exam.description && <p className="text-xs text-gray-500 truncate mt-0.5">{exam.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{exam.duration_minutes} minutes</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/admin/courses/${courseId}/exams/${exam.id}/questions`}
                      className="px-3 py-1.5 text-xs rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium"
                    >
                      Questions
                    </Link>
                    <button onClick={() => openEditModal(exam)} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(exam)} className="px-3 py-1.5 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{editingExamId ? 'Edit Exam' : 'Create Exam'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Exam title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={form.duration_minutes}
                  onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                  required
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_published: e.target.checked }))}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">Published (visible to students)</span>
              </label>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {isSaving ? 'Saving...' : editingExamId ? 'Update Exam' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
