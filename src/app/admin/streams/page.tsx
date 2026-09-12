'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import {
  fetchStreams,
  createStreamAction,
  updateStreamAction,
  deleteStreamAction,
  clearAdminError,
} from '@/lib/redux/slices/adminSlice'
import { getErrorMessage } from '@/lib/utils'
import { AdminStream } from '@/lib/api/admin'
import {
  getGradeSubjects,
  createGradeSubject,
  updateGradeSubject,
  deleteGradeSubject,
  type GradeSubject,
} from '@/lib/api/admin'

const GRADES = [5, 6, 7, 8, 9, 10, 11, 12, 13]

export default function SubjectsAndStreamsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated, isInitialized, isLoading: authLoading } = useAppSelector((s) => s.auth)
  const { streams, streamsLoading, error: adminError } = useAppSelector((s) => s.admin)

  const [activeTab, setActiveTab] = useState<'subjects' | 'streams'>('subjects')

  // ── Subjects state ────────────────────────────────────────────────────────
  const [activeGrade, setActiveGrade] = useState(10)
  const [gradeSubjects, setGradeSubjects] = useState<GradeSubject[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [creatingSubject, setCreatingSubject] = useState(false)
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null)
  const [editSubjectName, setEditSubjectName] = useState('')
  const [editSubjectActive, setEditSubjectActive] = useState(true)
  const [savingSubject, setSavingSubject] = useState(false)

  // ── Streams state ─────────────────────────────────────────────────────────
  const [showCreateStream, setShowCreateStream] = useState(false)
  const [showEditStream, setShowEditStream] = useState(false)
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null)
  const [isSubmittingStream, setIsSubmittingStream] = useState(false)
  const [streamForm, setStreamForm] = useState({
    name: '', description: '', subjectsText: '', is_active: true,
  })

  const [error, setError] = useState('')
  const combinedError = adminError || error

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const qs = searchParams.toString()
      router.push(`/login?callbackUrl=${encodeURIComponent(qs ? `${pathname}?${qs}` : pathname)}`)
      return
    }
    if (isAuthenticated && !user) { dispatch(fetchCurrentUser()); return }
    if (isAuthenticated && user && user.role !== 'admin' && user.role !== 'super_admin') { router.push('/'); return }
    if (isAuthenticated && user) dispatch(fetchStreams())
  }, [isAuthenticated, isInitialized, user, dispatch, router, pathname, searchParams])

  // ── Load subjects for active grade ────────────────────────────────────────
  const loadSubjects = async (grade: number) => {
    setSubjectsLoading(true)
    setError('')
    try {
      setGradeSubjects(await getGradeSubjects(grade))
    } catch { setError('Failed to load subjects') }
    finally { setSubjectsLoading(false) }
  }

  useEffect(() => {
    if (isAuthenticated && user && activeTab === 'subjects') loadSubjects(activeGrade)
  }, [activeGrade, activeTab, isAuthenticated, user])

  // ── Subjects handlers ─────────────────────────────────────────────────────
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newSubjectName.trim()
    if (!name) return
    setCreatingSubject(true); setError('')
    try {
      await createGradeSubject({ name, grade: activeGrade })
      setNewSubjectName('')
      await loadSubjects(activeGrade)
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to create subject') }
    finally { setCreatingSubject(false) }
  }

  const handleSaveSubject = async (id: string) => {
    setSavingSubject(true); setError('')
    try {
      await updateGradeSubject(id, { name: editSubjectName.trim(), is_active: editSubjectActive })
      setEditingSubjectId(null)
      await loadSubjects(activeGrade)
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to update subject') }
    finally { setSavingSubject(false) }
  }

  const handleDeleteSubject = async (s: GradeSubject) => {
    if (!confirm(`Delete "${s.name}" from Grade ${s.grade}? Existing courses are not affected.`)) return
    setError('')
    try {
      await deleteGradeSubject(s.id)
      await loadSubjects(activeGrade)
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to delete subject') }
  }

  // ── Streams handlers ──────────────────────────────────────────────────────
  const resetStreamForm = () => {
    setStreamForm({ name: '', description: '', subjectsText: '', is_active: true })
    setEditingStreamId(null)
    setError('')
    dispatch(clearAdminError())
  }

  const handleCreateStream = async (e: FormEvent) => {
    e.preventDefault()
    const subjects = streamForm.subjectsText.split(',').map(s => s.trim()).filter(Boolean)
    if (!subjects.length) { setError('Add at least one subject'); return }
    setIsSubmittingStream(true); setError('')
    try {
      await dispatch(createStreamAction({ name: streamForm.name, description: streamForm.description || undefined, subjects })).unwrap()
      setShowCreateStream(false); resetStreamForm()
    } catch (err: any) { setError(getErrorMessage(err) || 'Failed to create stream') }
    finally { setIsSubmittingStream(false) }
  }

  const handleUpdateStream = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingStreamId) return
    const subjects = streamForm.subjectsText.split(',').map(s => s.trim()).filter(Boolean)
    if (!subjects.length) { setError('Add at least one subject'); return }
    setIsSubmittingStream(true); setError('')
    try {
      await dispatch(updateStreamAction({ id: editingStreamId, data: { name: streamForm.name, description: streamForm.description || undefined, subjects, is_active: streamForm.is_active } })).unwrap()
      setShowEditStream(false); resetStreamForm()
    } catch (err: any) { setError(getErrorMessage(err) || 'Failed to update stream') }
    finally { setIsSubmittingStream(false) }
  }

  const handleDeleteStream = async (stream: AdminStream) => {
    if (!confirm(`Delete stream "${stream.name}"? This may affect courses and students assigned to it.`)) return
    setError('')
    try { await dispatch(deleteStreamAction(stream.id)).unwrap() }
    catch (err: any) { setError(getErrorMessage(err) || 'Failed to delete stream') }
  }

  const openEditStream = (stream: AdminStream) => {
    setStreamForm({ name: stream.name, description: stream.description || '', subjectsText: stream.subjects.join(', '), is_active: stream.is_active })
    setEditingStreamId(stream.id)
    setShowEditStream(true)
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 font-semibold italic animate-pulse">Verifying credentials...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Subjects &amp; Streams</h1>
            <p className="text-xs text-gray-500">Manage grade subjects and A/L educational streams</p>
          </div>
          <Link href="/admin/dashboard" className="px-4 py-2 text-sm text-teal-700 hover:bg-teal-50 rounded-lg">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {combinedError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            ⚠️ {combinedError}
          </div>
        )}

        {/* Tab switcher */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => { setActiveTab('subjects'); setError('') }}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === 'subjects'
                  ? 'bg-teal-50 text-teal-700 border-teal-600'
                  : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              Subjects
            </button>
            <button
              onClick={() => { setActiveTab('streams'); setError('') }}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === 'streams'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              Streams (A/L)
            </button>
          </div>

          {/* ── SUBJECTS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'subjects' && (
            <div>
              {/* Grade tabs */}
              <div className="flex flex-wrap border-b border-gray-100 px-1 pt-1">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    onClick={() => { setActiveGrade(g); setEditingSubjectId(null); setError('') }}
                    className={`px-4 py-2.5 text-sm font-semibold transition-colors rounded-t-lg mr-0.5 border-b-2 ${
                      activeGrade === g
                        ? 'text-teal-700 border-teal-600 bg-teal-50'
                        : 'text-gray-500 hover:text-gray-700 border-transparent hover:bg-gray-50'
                    }`}
                  >
                    Grade {g}
                  </button>
                ))}
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-gray-800">
                    Grade {activeGrade} Subjects
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      ({gradeSubjects.filter(s => s.is_active).length} active)
                    </span>
                  </h2>
                </div>

                {/* Add subject */}
                <form onSubmit={handleCreateSubject} className="flex gap-2 mb-5">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="e.g. Mathematics, ICT, Science…"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={creatingSubject || !newSubjectName.trim()}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    {creatingSubject ? 'Adding…' : '+ Add'}
                  </button>
                </form>

                {/* Subject list */}
                {subjectsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />)}
                  </div>
                ) : gradeSubjects.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-sm">No subjects yet for Grade {activeGrade}.</p>
                ) : (
                  <div className="space-y-2">
                    {gradeSubjects.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                          s.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'
                        }`}
                      >
                        {editingSubjectId === s.id ? (
                          <>
                            <input
                              type="text"
                              value={editSubjectName}
                              onChange={(e) => setEditSubjectName(e.target.value)}
                              className="flex-1 border border-teal-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                              autoFocus
                            />
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 font-medium cursor-pointer">
                              <input type="checkbox" checked={editSubjectActive} onChange={(e) => setEditSubjectActive(e.target.checked)} className="w-3.5 h-3.5 accent-teal-600" />
                              Active
                            </label>
                            <button onClick={() => handleSaveSubject(s.id)} disabled={savingSubject || !editSubjectName.trim()} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                              {savingSubject ? '…' : 'Save'}
                            </button>
                            <button onClick={() => setEditingSubjectId(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-medium text-gray-800">{s.name}</span>
                            {!s.is_active && <span className="text-[10px] font-bold uppercase text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>}
                            <button onClick={() => { setEditingSubjectId(s.id); setEditSubjectName(s.name); setEditSubjectActive(s.is_active); setError('') }} className="px-3 py-1.5 text-xs text-gray-600 hover:text-teal-700 rounded-lg hover:bg-teal-50 font-medium">Edit</button>
                            <button onClick={() => handleDeleteSubject(s)} className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 font-medium">Delete</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STREAMS TAB ──────────────────────────────────────────────── */}
          {activeTab === 'streams' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">A/L streams used to categorise Grade 12 &amp; 13 courses.</p>
                <button
                  onClick={() => { resetStreamForm(); setShowCreateStream(true) }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  + New Stream
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {streamsLoading ? (
                  Array(3).fill(0).map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)
                ) : streams.length === 0 ? (
                  <div className="col-span-full border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 text-sm italic">
                    No streams configured yet.
                  </div>
                ) : (
                  streams.map((stream) => (
                    <div key={stream.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
                      <div className="p-5 flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-base font-bold text-gray-900">{stream.name}</h3>
                            <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${stream.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {stream.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        {stream.description && <p className="text-xs text-gray-500 italic mb-3 line-clamp-2">"{stream.description}"</p>}
                        <div className="flex flex-wrap gap-1.5">
                          {stream.subjects.map((sub, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-medium rounded-md border border-indigo-100">{sub}</span>
                          ))}
                        </div>
                      </div>
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 rounded-b-xl flex gap-2">
                        <button onClick={() => openEditStream(stream)} className="flex-1 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">Edit</button>
                        <button onClick={() => handleDeleteStream(stream)} className="flex-1 px-3 py-2 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {activeTab === 'subjects' && (
          <p className="text-xs text-gray-400 italic">
            Tip: The same subject name can exist on multiple grades (e.g. ICT for Grades 10–13). Deleting a subject won't affect existing courses.
          </p>
        )}
      </main>

      {/* Stream Modal */}
      {(showCreateStream || showEditStream) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between bg-indigo-50/60">
              <h2 className="text-lg font-bold text-gray-900">{showCreateStream ? 'Create Stream' : 'Edit Stream'}</h2>
              <button onClick={() => { setShowCreateStream(false); setShowEditStream(false); resetStreamForm() }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={showCreateStream ? handleCreateStream : handleUpdateStream} className="p-7 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Stream Name</label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Technology, Commerce, Art"
                  value={streamForm.name}
                  onChange={(e) => setStreamForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Description (optional)</label>
                <textarea
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  rows={2}
                  placeholder="Brief summary..."
                  value={streamForm.description}
                  onChange={(e) => setStreamForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Subjects (comma-separated)</label>
                <textarea
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  rows={3}
                  placeholder="Physics, Combined Maths, ICT, Chemistry"
                  value={streamForm.subjectsText}
                  onChange={(e) => setStreamForm(p => ({ ...p, subjectsText: e.target.value }))}
                  required
                />
              </div>
              {showEditStream && (
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={streamForm.is_active} onChange={(e) => setStreamForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                  Stream is active
                </label>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreateStream(false); setShowEditStream(false); resetStreamForm() }} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 text-sm">Cancel</button>
                <button type="submit" disabled={isSubmittingStream} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 text-sm">
                  {isSubmittingStream ? 'Saving…' : showCreateStream ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
