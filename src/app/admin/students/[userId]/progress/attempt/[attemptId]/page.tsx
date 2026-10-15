'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchStudentAttemptReview } from '@/lib/redux/slices/adminSlice'
import { ArrowLeft, XCircle, User as UserIcon } from 'lucide-react'
import AttemptReviewContent from '@/components/analytics/AttemptReviewContent'

export default function AdminAttemptReviewPage() {
  const params = useParams()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const userId = params?.userId as string
  const attemptId = params?.attemptId as string
  
  const { selectedAttemptReview: result, reviewLoading: loading, error } = useAppSelector((state) => state.admin)

  useEffect(() => {
    if (!userId || !attemptId) return
    dispatch(fetchStudentAttemptReview({ userId, attemptId }))
  }, [dispatch, userId, attemptId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfcfd] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-900/10 border-t-gray-900 rounded-full animate-spin mx-auto mb-6" />
          <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">Retrieving Submission Audit...</p>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-[#fcfcfd] p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border border-red-100 rounded-[2.5rem] p-10 text-center shadow-2xl">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="text-red-500" size={40} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Audit Failed</h1>
          <p className="text-gray-500 mb-8 font-medium">{error || 'Attempt data is unavailable'}</p>
          <button
            onClick={() => router.back()}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all"
          >
            Back to Progress
          </button>
        </div>
      </div>
    )
  }

  const scorePct = Math.round((result.marks_obtained / result.total_questions) * 100)
  const isPass = scorePct >= 85

  return (
    <div className="min-h-screen bg-[#fcfcfd] pb-24">
      {/* Admin Audit Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-black text-xs uppercase tracking-widest"
            >
              <ArrowLeft size={18} />
              <span>Back to Audit</span>
            </button>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-0.5">
                 <UserIcon size={12} className="text-teal-600" />
                 <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Pedagogical Oversight</span>
              </div>
              <h1 className="text-sm font-black text-gray-900 uppercase tracking-tight italic">
                 {result.ranking.exam_title}
              </h1>
            </div>
            <div className={`px-4 py-1.5 rounded-full ${isPass ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'} font-black text-[10px] uppercase tracking-widest border border-current opacity-70`}>
              {scorePct}% SUBMISSION
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <AttemptReviewContent result={result} />
      </div>

      <div className="mt-4 flex items-center justify-center">
           <button 
             onClick={() => router.back()}
             className="px-10 py-5 bg-gray-900 text-white rounded-[2rem] font-black text-lg hover:bg-black hover:scale-105 transition-all shadow-xl"
           >
             CLOSE AUDIT VIEW
           </button>
      </div>
    </div>
  )
}
