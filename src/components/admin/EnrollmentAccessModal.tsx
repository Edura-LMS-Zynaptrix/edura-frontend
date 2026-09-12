'use client'

import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { 
  fetchEnrolledStudents, fetchEligibleStudents, grantExamAccessAction, revokeExamAccessAction,
  fetchCourseEnrolledStudents, fetchCourseEligibleStudents, grantCourseAccessAction, revokeCourseAccessAction,
  fetchSubCourseEnrolledStudents, fetchSubCourseEligibleStudents, grantSubCourseAccessAction, revokeSubCourseAccessAction,
  fetchVideoModuleEnrolledStudents, fetchVideoModuleEligibleStudents, grantVideoModuleAccessAction, revokeVideoModuleAccessAction
} from '@/lib/redux/slices/examsSlice'

interface EnrollmentAccessModalProps {
  type: 'exam' | 'course' | 'sub_course' | 'module'
  id: string
  title: string
  onClose: () => void
}

export default function EnrollmentAccessModal({ type, id, title, onClose }: EnrollmentAccessModalProps) {
  const dispatch = useAppDispatch()
  const { enrolledStudents: enrolled, eligibleStudents: eligible, accessLoading: loading, accessError: error } = useAppSelector(state => state.exams)
  
  const [activeTab, setActiveTab] = useState<'enrolled' | 'eligible'>('eligible')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [selectedEligible, setSelectedEligible] = useState<string[]>([])

  const fetchData = async () => {
    if (type === 'exam') {
      dispatch(fetchEnrolledStudents(id))
      dispatch(fetchEligibleStudents({ examId: id }))
    } else if (type === 'course') {
      dispatch(fetchCourseEnrolledStudents(id))
      dispatch(fetchCourseEligibleStudents({ courseId: id }))
    } else if (type === 'sub_course') {
      dispatch(fetchSubCourseEnrolledStudents(id))
      dispatch(fetchSubCourseEligibleStudents({ subCourseId: id }))
    } else {
      dispatch(fetchVideoModuleEnrolledStudents(id))
      dispatch(fetchVideoModuleEligibleStudents({ moduleId: id }))
    }
  }

  useEffect(() => {
    fetchData()
  }, [id, type])

  const handleGrantAccess = async () => {
    if (selectedEligible.length === 0) return
    try {
      setActionLoadingId('grant')
      if (type === 'exam') {
        await dispatch(grantExamAccessAction({ examId: id, userIds: selectedEligible })).unwrap()
      } else if (type === 'course') {
        await dispatch(grantCourseAccessAction({ courseId: id, userIds: selectedEligible })).unwrap()
      } else if (type === 'sub_course') {
        await dispatch(grantSubCourseAccessAction({ subCourseId: id, userIds: selectedEligible })).unwrap()
      } else {
        await dispatch(grantVideoModuleAccessAction({ moduleId: id, userIds: selectedEligible })).unwrap()
      }
      setSelectedEligible([])
      await fetchData()
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleRevokeAccess = async (userId: string) => {
    if (!window.confirm('Are you sure you want to revoke access for this student?')) return
    try {
      setActionLoadingId(userId)
      if (type === 'exam') {
        await dispatch(revokeExamAccessAction({ examId: id, userId })).unwrap()
      } else if (type === 'course') {
        await dispatch(revokeCourseAccessAction({ courseId: id, userId })).unwrap()
      } else if (type === 'sub_course') {
        await dispatch(revokeSubCourseAccessAction({ subCourseId: id, userId })).unwrap()
      } else {
        await dispatch(revokeVideoModuleAccessAction({ moduleId: id, userId })).unwrap()
      }
    } finally {
      setActionLoadingId(null)
    }
  }

  const filteredEligible = eligible.filter(s => 
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.school && s.school.toLowerCase().includes(search.toLowerCase())) ||
    (s.district && s.district.toLowerCase().includes(search.toLowerCase()))
  )

  const filteredEnrolled = enrolled.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const typeLabel = type === 'exam' ? 'Exam' : type === 'course' ? 'Course' : 'Module'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manage {typeLabel} Access</h2>
            <p className="text-sm text-gray-500">{title}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs & Search */}
        <div className="px-6 py-4 border-b border-gray-50 space-y-4">
          <div className="flex gap-4 border-b border-gray-100">
            <button
              onClick={() => setActiveTab('eligible')}
              className={`pb-2 px-1 text-sm font-medium transition-all ${
                activeTab === 'eligible' ? 'border-b-2 border-teal-600 text-teal-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Eligible Students ({eligible.length})
            </button>
            <button
              onClick={() => setActiveTab('enrolled')}
              className={`pb-2 px-1 text-sm font-medium transition-all ${
                activeTab === 'enrolled' ? 'border-b-2 border-teal-600 text-teal-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Enrolled Students ({enrolled.length})
            </button>
          </div>

          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Loading records...</p>
            </div>
          ) : activeTab === 'eligible' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Select students to grant access
                </p>
                {selectedEligible.length > 0 && (
                  <button
                    onClick={handleGrantAccess}
                    disabled={selectedEligible.length === 0 || actionLoadingId === 'grant'}
                    className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-semibold"
                  >
                    {actionLoadingId === 'grant' ? 'Granting...' : `Grant Access (${selectedEligible.length})`}
                  </button>
                )}
              </div>

              {filteredEligible.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No eligible students found</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredEligible.map(s => (
                    <div 
                      key={s.user_id}
                      onClick={() => {
                        setSelectedEligible(prev => 
                          prev.includes(s.user_id) 
                            ? prev.filter(id => id !== s.user_id)
                            : [...prev, s.user_id]
                        )
                      }}
                      className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center gap-3 ${
                        selectedEligible.includes(s.user_id) 
                          ? 'border-teal-500 bg-teal-50 shadow-sm' 
                          : 'border-gray-100 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                        selectedEligible.includes(s.user_id) ? 'bg-teal-600 border-teal-600' : 'border-gray-300'
                      }`}>
                        {selectedEligible.includes(s.user_id) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{s.full_name}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-semibold">G{s.grade} • {s.district}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEnrolled.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No enrolled students found</div>
              ) : (
                <div className="space-y-2">
                  {filteredEnrolled.map(s => (
                    <div key={s.user_id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{s.full_name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">Enrolled: {new Date(s.enrolled_at).toLocaleDateString()}</span>
                            {s.is_manual && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">Manual</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeAccess(s.user_id)}
                        disabled={actionLoadingId === s.user_id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                        title="Revoke Access"
                      >
                        {actionLoadingId === s.user_id ? (
                          <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all text-sm shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
