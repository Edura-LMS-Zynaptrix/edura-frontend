'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchAdminBankSlipsThunk, verifyBankSlipThunk, clearPaymentError, fetchEarningsAnalysisThunk } from '@/lib/redux/slices/paymentSlice'
import * as paymentApi from '@/lib/api/payment'
import * as adminApi from '@/lib/api/admin'

export default function AdminPaymentPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)
  const { allSlips: bankSlips, isLoading: loading, error, earningsAnalysis } = useAppSelector((state) => state.payment)

  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'earnings'>('pending')
  const [localError, setLocalError] = useState('')
  const [verifying, setVerifying] = useState<string | null>(null)
  const [selectedSlip, setSelectedSlip] = useState<paymentApi.BankSlipResponse | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [courses, setCourses] = useState<any[]>([])
  const [isCousersLoading, setIsCoursesLoading] = useState(false)

  const getSlipImageUrl = (url: string) => {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      console.error('NEXT_PUBLIC_API_URL is not configured')
      return ''
    }
    return `${apiUrl}${url}`
  }

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'super_admin') {
      router.push('/dashboard')
      return
    }
    
    // Fetch courses list for filtering
    const loadCourses = async () => {
      try {
        setIsCoursesLoading(true)
        const data = await adminApi.getCourses()
        setCourses(data)
      } catch (err) {
        console.error('Failed to load courses:', err)
      } finally {
        setIsCoursesLoading(false)
      }
    }
    loadCourses()
  }, [user])

  useEffect(() => {
    if (activeTab === 'earnings') {
      dispatch(fetchEarningsAnalysisThunk(selectedCourseId || undefined))
    } else {
      loadBankSlips()
    }
  }, [activeTab, selectedCourseId])

  const loadBankSlips = async () => {
    try {
      dispatch(clearPaymentError())
      const filter = activeTab === 'pending' ? 'pending' : undefined
      await dispatch(fetchAdminBankSlipsThunk({ 
        statusFilter: filter, 
        courseId: selectedCourseId || undefined 
      })).unwrap()
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to load bank slips')
    }
  }

  const handleVerify = async (slipId: string) => {
    try {
      setVerifying(slipId)
      setLocalError('')
      await dispatch(verifyBankSlipThunk({ slipId, verification: { status: 'verified' } })).unwrap()
      // Optional: reload all slips or let Redux slice update it
      // The slice currently updates the item in `allSlips`
      setSelectedSlip(null)
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to verify bank slip')
    } finally {
      setVerifying(null)
    }
  }

  const handleReject = async (slipId: string) => {
    if (!rejectionReason.trim()) {
      setLocalError('Please provide a rejection reason')
      return
    }

    try {
      setVerifying(slipId)
      setLocalError('')
      
      await dispatch(verifyBankSlipThunk({ 
        slipId, 
        verification: { status: 'rejected', rejection_reason: rejectionReason } 
      })).unwrap()

      setSelectedSlip(null)
      setRejectionReason('')
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to reject bank slip')
    } finally {
      setVerifying(null)
    }
  }

  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
            <p className="text-gray-600 mt-1">Review and verify student payment submissions</p>
          </div>
          <button
            onClick={() => router.push('/admin/payments/bank-accounts')}
            className="inline-flex items-center px-4 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors font-semibold shadow-sm"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Manage Bank Accounts
          </button>
        </div>

        {/* Global Filter Bar */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Filter by Course
            </label>
            <div className="relative">
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={isCousersLoading}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-700 font-medium"
              >
                <option value="">All Courses (Aggregated View)</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} ({course.subject} - G{course.grade})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="flex items-end h-full">
            <button
              onClick={() => {
                setSelectedCourseId('')
                setLocalError('')
              }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium h-[42px]"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'pending'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pending Review ({bankSlips.filter(s => s.status === 'pending').length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'all'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Submissions
              </button>
              <button
                onClick={() => setActiveTab('earnings')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'earnings'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Earnings Analysis
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading submissions...</p>
              </div>
            ) : error || localError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error || localError}
              </div>
            ) : activeTab !== 'earnings' && bankSlips.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No bank slips to review</p>
              </div>
            ) : activeTab === 'earnings' ? (
              <div className="space-y-8">
                {earningsAnalysis ? (
                  <>
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                      <h2 className="text-xl font-bold text-gray-900">
                        {selectedCourseId ? 'Course-Specific Breakdown' : 'Global Revenue Summary'}
                      </h2>
                      <div className="text-xs text-gray-500">
                        Last Updated: {new Date(earningsAnalysis.updated_at).toLocaleString()}
                      </div>
                    </div>
                    
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-teal-600 rounded-xl p-6 text-white shadow-lg shadow-teal-100">
                        <p className="text-teal-100 text-sm font-medium uppercase tracking-wider mb-1">Total Revenue</p>
                        <p className="text-4xl font-bold">Rs. {earningsAnalysis.total_revenue.toLocaleString()}</p>
                      </div>
                      <div className="bg-indigo-600 rounded-xl p-6 text-white shadow-lg shadow-indigo-100">
                        <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">Total Enrollments</p>
                        <p className="text-4xl font-bold">{earningsAnalysis.total_enrollments.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Breakdown Table */}
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Revenue Breakdown by Item
                      </h3>
                      <div className="overflow-x-auto border border-gray-100 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-widest">
                            <tr>
                              <th className="px-6 py-4 text-left font-bold">Item Title</th>
                              <th className="px-6 py-4 text-left font-bold">Type</th>
                              <th className="px-6 py-4 text-center font-bold">Grade</th>
                              <th className="px-6 py-4 text-right font-bold">Enrollments</th>
                              <th className="px-6 py-4 text-right font-bold">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {earningsAnalysis.by_item.map((item) => (
                              <tr key={`${item.item_type}-${item.item_id}`} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-gray-900 font-medium">{item.item_title}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                                    item.item_type === 'course' ? 'bg-blue-100 text-blue-700' :
                                    item.item_type === 'sub_course' ? 'bg-purple-100 text-purple-700' :
                                    item.item_type === 'module' ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {item.item_type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center text-gray-700">
                                  {item.item_grade ? `Grade ${item.item_grade}` : '—'}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-700 tabular-nums">{item.enrollment_count}</td>
                                <td className="px-6 py-4 text-right text-teal-700 font-bold tabular-nums">
                                  Rs. {item.total_revenue.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20">
                    <p className="text-gray-400 italic">No analysis data available for current selection</p>
                  </div>
                )}
              </div>
            ) : bankSlips.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No bank slips found for the current filter</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Bank</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Item</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Depositor</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Submitted</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bankSlips.map((slip) => (
                      <tr key={slip.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                            slip.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : slip.status === 'verified'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {slip.status.charAt(0).toUpperCase() + slip.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{slip.bank_name || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 font-medium truncate max-w-[200px]" title={slip.item_name}>
                            {slip.item_name || '—'}
                          </div>
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                            {slip.payment_type || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-semibold">
                          Rs. {slip.amount?.toLocaleString() || '0'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{slip.depositor_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {new Date(slip.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedSlip(slip)}
                            className="text-teal-600 hover:text-teal-700 font-medium text-xs"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slip Detail Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-4 border-b pb-4">
                <h2 className="text-lg font-bold text-gray-900">Bank Slip Review</h2>
                <button
                  onClick={() => {
                    setSelectedSlip(null)
                    setRejectionReason('')
                    setLocalError('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Image */}
              <div className="mb-4">
                <img
                  src={getSlipImageUrl(selectedSlip.slip_image_url)}
                  alt="Bank slip"
                  className="w-full rounded border border-gray-200"
                />
              </div>

              {/* Details */}
              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Status:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    selectedSlip.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : selectedSlip.status === 'verified'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedSlip.status.charAt(0).toUpperCase() + selectedSlip.status.slice(1)}
                  </span>
                </div>
                <div className="bg-teal-50 border border-teal-100 rounded p-3 my-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-teal-800 font-medium">Payment For:</span>
                    <span className="text-teal-900 font-bold">{selectedSlip.item_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-teal-800 font-medium">Target Amount:</span>
                    <span className="text-teal-900 font-bold">Rs. {selectedSlip.amount?.toLocaleString()}</span>
                  </div>
                </div>
                {selectedSlip.bank_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Bank:</span>
                    <span className="text-gray-900">{selectedSlip.bank_name}</span>
                  </div>
                )}
                {selectedSlip.depositor_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Depositor:</span>
                    <span className="text-gray-900">{selectedSlip.depositor_name}</span>
                  </div>
                )}
                {selectedSlip.reference_number && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Ref No.:</span>
                    <span className="text-gray-900 font-mono">{selectedSlip.reference_number}</span>
                  </div>
                )}
                {selectedSlip.deposit_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Deposit Date:</span>
                    <span className="text-gray-900">{new Date(selectedSlip.deposit_date).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Submitted:</span>
                  <span className="text-gray-900 text-xs">{new Date(selectedSlip.created_at).toLocaleString()}</span>
                </div>

                {selectedSlip.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 mt-3">
                    <p className="text-xs font-medium text-red-900 mb-1">Rejection Reason:</p>
                    <p className="text-xs text-red-700">{selectedSlip.rejection_reason}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedSlip.status === 'pending' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Rejection Reason
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide reason if rejecting..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  {(error || localError) && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                      {error || localError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(selectedSlip.id)}
                      disabled={verifying === selectedSlip.id}
                      className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 font-medium"
                    >
                      {verifying === selectedSlip.id ? 'Processing...' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleVerify(selectedSlip.id)}
                      disabled={verifying === selectedSlip.id}
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      {verifying === selectedSlip.id ? 'Processing...' : 'Approve'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
