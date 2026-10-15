'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchAdminStudents, toggleStudentActiveStatus, deleteStudentAction } from '@/lib/redux/slices/adminSlice'
import toast from 'react-hot-toast'

const GRADES = [5, 6, 7, 8, 9, 10, 11, 12, 13]

export default function AdminStudentsPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((s) => s.auth)
  const { students, studentsTotal: total, studentsLoading: loading, error } = useAppSelector((s) => s.admin)

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [grade, setGrade] = useState<number | ''>('')
  const [district, setDistrict] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Pagination
  const [page, setPage] = useState(0)
  const limit = 20

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'super_admin') router.push('/')
  }, [user, router])

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) return
    const params: Record<string, any> = { skip: page * limit, limit }
    if (search) params.search = search
    if (grade !== '') params.grade = grade
    if (district) params.district = district
    if (activeFilter === 'active') params.is_active = true
    if (activeFilter === 'inactive') params.is_active = false
    dispatch(fetchAdminStudents(params))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, search, grade, district, activeFilter, page])

  const handleToggle = async (userId: string) => {
    try {
      setTogglingId(userId)
      await dispatch(toggleStudentActiveStatus(userId)).unwrap()
    } catch {
      // error is in Redux state
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (userId: string, name: string) => {
    if (!window.confirm(`⚠️ PERMANENT DELETE: "${name}"\n\nAre you sure? This will IRREVERSIBLY delete:\n- Entire Student Profile\n- All Course & Exam Enrollments\n- All Exam Attempts & Result History\n- All Payment Records & Bank Slips\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      setDeletingId(userId)
      await dispatch(deleteStudentAction(userId)).unwrap()
    } catch {
      // error is in Redux state
    } finally {
      setDeletingId(null)
    }
  }

  const handleCopyNIC = (nic: string) => {
    navigator.clipboard.writeText(nic)
    toast.success('NIC copied to clipboard')
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Students</h1>
            <p className="text-sm text-gray-500 mt-1">
              {total.toLocaleString()} student{total !== 1 ? 's' : ''} registered
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search name, email, school or phone…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Grade */}
            <select
              value={grade}
              onChange={(e) => { setGrade(e.target.value === '' ? '' : Number(e.target.value)); setPage(0) }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="">All Grades</option>
              {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>

            {/* District */}
            <input
              type="text"
              placeholder="District…"
              value={district}
              onChange={(e) => { setDistrict(e.target.value); setPage(0) }}
              className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />

            {/* Status */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(['all', 'active', 'inactive'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => { setActiveFilter(v); setPage(0) }}
                  className={`px-3 py-2 capitalize transition-colors ${
                    activeFilter === v ? 'bg-teal-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Grade</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">District</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">School</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Enrollments</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Attempts</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(10)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-gray-400">
                      No students found
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr key={s.user_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-xs shrink-0 overflow-hidden">
                            {s.profile_photo_url
                              ? <img src={s.profile_photo_url} alt="" className="w-8 h-8 object-cover" />
                              : s.full_name.charAt(0).toUpperCase()
                            }
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 flex items-center gap-2">
                              {s.full_name}
                              {s.needs_profile_completion && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">Incomplete</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">Grade {s.grade}</td>
                      <td className="px-4 py-3 text-gray-700 hidden sm:table-cell font-medium">
                        <div>
                          <p className="text-xs">{s.phone_number || <span className="text-gray-400 italic">No Phone</span>}</p>
                          {s.parent_phone_number && <p className="text-[10px] text-gray-400 font-normal">P: {s.parent_phone_number}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{s.district}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell max-w-[180px] truncate">{s.school}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-medium">
                          {s.enrollment_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                          {s.attempt_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => router.push(`/admin/students/${s.user_id}/progress`)}
                            className="text-xs px-3 py-1 rounded-lg font-medium bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                          >
                            Progress
                          </button>
                          <button
                            onClick={() => handleToggle(s.user_id)}
                            disabled={togglingId === s.user_id || deletingId === s.user_id}
                            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                              s.is_active
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {togglingId === s.user_id ? '…' : s.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(s.user_id, s.full_name)}
                            disabled={deletingId === s.user_id || togglingId === s.user_id}
                            className="text-xs px-3 py-1 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-red-600 hover:text-white transition-all disabled:opacity-50 flex items-center gap-1"
                            title="Permanently Delete"
                          >
                            {deletingId === s.user_id ? '…' : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
              <span>
                Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
