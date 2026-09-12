'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchAttemptReview } from '@/lib/redux/slices/studentDashboardSlice'
import { ArrowLeft, XCircle, Download } from 'lucide-react'
import AttemptReviewContent from '@/components/analytics/AttemptReviewContent'

export default function AttemptReviewPage() {
  const params = useParams()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const attemptId = params?.attemptId as string
  const { user } = useAppSelector((state) => state.auth)
  const { selectedAttemptReview: result, loadingReview: loading, error } = useAppSelector((state) => state.studentDashboard)

  const contentRef = useRef<HTMLDivElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  const downloadPDF = async () => {
    if (!contentRef.current || isCapturing || !result) return
    setIsCapturing(true)
    await new Promise(r => setTimeout(r, 100))
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const A4_W = 210, A4_H = 297, MARGIN = 10
      const HEADER_H = 18, FOOTER_H = 12
      const CONTENT_W = A4_W - 2 * MARGIN
      const CONTENT_TOP = MARGIN + HEADER_H + 3
      const CONTENT_BOTTOM = A4_H - MARGIN - FOOTER_H - 3

      // 719px ≈ A4 content width (190mm) at 96dpi — forces consistent desktop-like layout
      const opts = {
        useCORS: true,
        scale: 2,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        onclone: (_doc: Document, el: Element) => {
          const h = el as HTMLElement
          h.style.setProperty('width', '719px', 'important')
          h.style.setProperty('max-width', '719px', 'important')
          h.style.setProperty('box-sizing', 'border-box', 'important')
        },
      }
      const sections = Array.from(contentRef.current.querySelectorAll('[data-pdf-section]')) as HTMLElement[]

      const captures: { imgData: string; heightMM: number }[] = []
      for (const el of sections) {
        const canvas = await html2canvas(el, opts)
        captures.push({ imgData: canvas.toDataURL('image/png'), heightMM: (canvas.height / canvas.width) * CONTENT_W })
      }

      type PageItem = { imgData: string; heightMM: number; y: number }
      const pages: PageItem[][] = [[]]
      let curY = CONTENT_TOP, pi = 0
      for (const cap of captures) {
        if (curY + cap.heightMM > CONTENT_BOTTOM && pages[pi].length > 0) {
          pages.push([])
          pi++
          curY = CONTENT_TOP
        }
        pages[pi].push({ ...cap, y: curY })
        curY += cap.heightMM + 3
      }

      const totalPages = pages.length
      const scorePct = Math.round((result.marks_obtained / result.total_questions) * 100)
      const title = result.ranking?.exam_title || 'Exam Review'
      const pdf = new jsPDF('p', 'mm', 'a4')

      const drawHeader = () => {
        pdf.setFillColor(13, 148, 136)
        pdf.rect(0, 0, A4_W, MARGIN + HEADER_H, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.text(title.length > 55 ? title.slice(0, 52) + '...' : title, MARGIN, MARGIN + 11)
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`Score: ${scorePct}% | ${result.marks_obtained}/${result.total_questions}`, A4_W - MARGIN, MARGIN + 11, { align: 'right' })
      }

      const drawFooter = (pageNum: number) => {
        const fy = A4_H - MARGIN - FOOTER_H
        pdf.setDrawColor(229, 231, 235)
        pdf.setLineWidth(0.3)
        pdf.line(MARGIN, fy, A4_W - MARGIN, fy)
        pdf.setTextColor(107, 114, 128)
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        pdf.text('Edura', MARGIN, fy + 7)
        pdf.text(`Page ${pageNum} / ${totalPages}`, A4_W - MARGIN, fy + 7, { align: 'right' })
      }

      pages.forEach((page, idx) => {
        if (idx > 0) pdf.addPage()
        drawHeader()
        drawFooter(idx + 1)
        for (const item of page) {
          pdf.addImage(item.imgData, 'PNG', MARGIN, item.y, CONTENT_W, item.heightMM)
        }
      })

      pdf.save(`exam-review-${attemptId}.pdf`)
    } finally {
      setIsCapturing(false)
    }
  }

  useEffect(() => {
    if (!attemptId) return
    dispatch(fetchAttemptReview(attemptId))
  }, [dispatch, attemptId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your submission...</p>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto bg-white border border-red-100 rounded-3xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Review Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Data is unavailable'}</p>
          <button
            onClick={() => router.push('/student/my-results')}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors"
          >
            Back to Results
          </button>
        </div>
      </div>
    )
  }

  const scorePct = Math.round((result.marks_obtained / result.total_questions) * 100)
  const isPass = scorePct >= 85

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-bold text-sm"
            >
              <ArrowLeft size={18} />
              <span>Back to Journey</span>
            </button>
            <div className="text-center hidden sm:block">
              <h1 className="text-lg font-black text-gray-900 uppercase tracking-tight">{result.ranking.exam_title}</h1>
              <p className="text-xs text-gray-500 font-medium">{result.ranking.subject}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadPDF}
                disabled={isCapturing}
                className="flex items-center gap-2 px-4 py-1.5 bg-teal-600 text-white rounded-full text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60"
              >
                {isCapturing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    Download PDF
                  </>
                )}
              </button>
              <div className={`px-4 py-1.5 rounded-full ${isPass ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'} font-black text-sm`}>
                {scorePct}% SCORE
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref={contentRef}>
        <AttemptReviewContent result={result} isCapturing={isCapturing} />
      </div>

      <div className="mt-4 flex items-center justify-center pb-12">
        <button
          onClick={() => router.push('/student/my-results')}
          className="px-10 py-5 bg-gray-900 text-white rounded-[2rem] font-black text-lg hover:bg-black hover:scale-105 transition-all shadow-xl"
        >
          DONE REVIEWING
        </button>
      </div>
    </div>
  )
}
