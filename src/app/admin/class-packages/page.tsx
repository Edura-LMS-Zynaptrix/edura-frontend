'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppSelector, useAppDispatch } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchStreams } from '@/lib/redux/slices/adminSlice'
import {
  getClassPackages,
  createClassPackage,
  updateClassPackage,
  deleteClassPackage,
  autoGenerateClassPackages,
  type ClassPackage,
  type ClassPackageCreateData,
} from '@/lib/api/admin'
import { getErrorMessage } from '@/lib/utils'

const ALL_GRADES = [5, 6, 7, 8, 9, 10, 11, 12, 13]

function gradeLabel(grade: number) {
  if (grade === 11) return 'Grade 11 (covers 10 & 11)'
  if (grade === 13) return 'Grade 13 (covers 12 & 13)'
  return `Grade ${grade}`
}

const emptyForm: ClassPackageCreateData = {
  name: '',
  description: '',
  grade: 10,
  stream_id: null,
  price: 0,
  is_active: true,
}

export default function ClassPackagesPage() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const { user, isAuthenticated, isInitialized } = useAppSelector((s) => s.auth)
  const { streams } = useAppSelector((s) => s.admin)

  const [mounted, setMounted] = useState(false)
  const [packages, setPackages] = useState<ClassPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filter
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<string>('all')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ClassPackageCreateData>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isInitialized) dispatch(fetchCurrentUser())
  }, [isInitialized, dispatch])

  useEffect(() => {
    if (isInitialized && !isAuthenticated) router.push('/login')
    if (isInitialized && user && user.role === 'student') router.push('/student/courses')
  }, [isInitialized, isAuthenticated, user, router])

  useEffect(() => {
    if (streams.length === 0) dispatch(fetchStreams())
  }, [streams.length, dispatch])

  const loadPackages = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getClassPackages()
      setPackages(data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPackages() }, [loadPackages])

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setError('')
    setShowModal(true)
  }

  function openEdit(pkg: ClassPackage) {
    setEditingId(pkg.id)
    setForm({
      name: pkg.name,
      description: pkg.description ?? '',
      grade: pkg.grade,
      stream_id: pkg.stream_id,
      price: pkg.price,
      is_active: pkg.is_active,
    })
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setForm({ ...emptyForm })
    setError('')
  }

  // Auto-set name when grade/stream changes in the form
  function handleGradeChange(grade: number) {
    const streamName = form.stream_id
      ? streams.find((s) => s.id === form.stream_id)?.name ?? ''
      : ''
    const autoName = grade >= 12
      ? `Grade ${grade}${streamName ? ' - ' + streamName : ''}`
      : `Grade ${grade} Class`
    setForm((f) => ({ ...f, grade, stream_id: grade < 12 ? null : f.stream_id, name: editingId ? f.name : autoName }))
  }

  function handleStreamChange(stream_id: string | null) {
    const streamName = stream_id ? streams.find((s) => s.id === stream_id)?.name ?? '' : ''
    const autoName = `Grade ${form.grade}${streamName ? ' - ' + streamName : ''}`
    setForm((f) => ({ ...f, stream_id, name: editingId ? f.name : autoName }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await updateClassPackage(editingId, form)
        setSuccess('Class package updated.')
      } else {
        await createClassPackage(form)
        setSuccess('Class package created.')
      }
      closeModal()
      await loadPackages()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteClassPackage(id)
      setSuccess('Class package deleted.')
      setDeletingId(null)
      await loadPackages()
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  async function handleAutoGenerate() {
    setGenerating(true)
    setError('')
    try {
      const res = await autoGenerateClassPackages()
      if (res.count === 0) {
        setSuccess('All class packages already exist — nothing to generate.')
      } else {
        setSuccess(`Generated ${res.count} new package(s): ${res.created.join(', ')}`)
      }
      await loadPackages()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setGenerating(false)
    }
  }

  // Filter
  const filtered = packages.filter((p) => {
    if (filterGrade !== 'all' && p.grade !== Number(filterGrade)) return false
    if (filterActive === 'active' && !p.is_active) return false
    if (filterActive === 'inactive' && p.is_active) return false
    return true
  })

  // Group by grade for display
  const byGrade: Record<number, ClassPackage[]> = {}
  for (const p of filtered) {
    if (!byGrade[p.grade]) byGrade[p.grade] = []
    byGrade[p.grade].push(p)
  }
  const sortedGrades = Object.keys(byGrade).map(Number).sort((a, b) => a - b)

  if (!mounted || !isInitialized || !user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Class Packages</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Grade-level bundles — students buy a class and get access to all matching courses.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleAutoGenerate}
              disabled={generating}
              className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition disabled:opacity-60"
            >
              {generating ? 'Generating…' : '⚡ Auto-Generate Missing'}
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition"
            >
              + New Package
            </button>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="text-green-500 hover:text-green-700">✕</button>
          </div>
        )}

        {/* Access rules info */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <p className="font-semibold mb-1">Access Rules</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-700">
            <li>Grade 5–10: access all courses of that exact grade</li>
            <li>Grade 11: access all Grade 10 <strong>&amp;</strong> 11 courses</li>
            <li>Grade 12 (+ stream): access all Grade 12 courses in that stream</li>
            <li>Grade 13 (+ stream): access all Grade 12 <strong>&amp;</strong> 13 courses in that stream</li>
          </ul>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="all">All Grades</option>
            {ALL_GRADES.map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="ml-auto text-sm text-gray-400 self-center">{filtered.length} package(s)</span>
        </div>

        {/* Package list grouped by grade */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sortedGrades.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-medium">No class packages yet.</p>
            <p className="text-sm mt-1">Click <strong>Auto-Generate Missing</strong> to create packages for all grades automatically.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedGrades.map((grade) => (
              <div key={grade}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {grade >= 12 ? `A/L — Grade ${grade}` : grade >= 10 ? `O/L — Grade ${grade}` : `Primary — Grade ${grade}`}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {byGrade[grade].map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`bg-white rounded-xl border p-5 flex flex-col gap-3 ${pkg.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 leading-tight">{pkg.name}</p>
                          {pkg.stream_name && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-full border border-teal-100">
                              {pkg.stream_name}
                            </span>
                          )}
                        </div>
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${pkg.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {pkg.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {pkg.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{pkg.description}</p>
                      )}

                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                        <span className="font-bold text-teal-600 text-sm">
                          {pkg.price === 0 ? 'Free' : `LKR ${pkg.price.toLocaleString()}`}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(pkg)}
                            className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeletingId(pkg.id)}
                            className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Edit Class Package' : 'Create Class Package'}
              </h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade *</label>
                <select
                  value={form.grade}
                  onChange={(e) => handleGradeChange(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  {ALL_GRADES.map((g) => (
                    <option key={g} value={g}>{gradeLabel(g)}</option>
                  ))}
                </select>
              </div>

              {form.grade >= 12 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stream (A/L only)</label>
                  <select
                    value={form.stream_id ?? ''}
                    onChange={(e) => handleStreamChange(e.target.value || null)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">No stream (all streams)</option>
                    {streams.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Leave blank to allow access to all A/L courses regardless of stream.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Grade 10 Class"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="What does this package include?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (LKR)</label>
                <input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Set to 0 for a free package.</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 accent-teal-600"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active (visible to students)</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Package?</h2>
            <p className="text-sm text-gray-500 mb-6">
              This will remove the class package. Existing student enrollments linked to this package will also be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
