'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import * as studentApi from '@/lib/api/student'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { startExam, submitExamAttempt, fetchLastAttempt, checkExamAccess } from '@/lib/redux/slices/examsSlice'
import { markExamAttempted } from '@/lib/redux/slices/coursesSlice'
import { StatusModal } from '@/components/StatusModal'
import {
  saveOngoingExam,
  getOngoingExam,
  clearOngoingExam,
  getSecondsRemaining,
} from '@/lib/ongoingExam'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function optionLabel(order: number): string {
  return String.fromCharCode(64 + order)
}

/** Returns true if the user is on a mobile/tablet device */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ('ontouchstart' in window && window.innerWidth < 1024)
}

// ── Start Confirmation Modal ─────────────────────────────────────────────────

interface StartModalProps {
  examTitle: string
  durationMinutes: number
  totalQuestions: number
  onConfirm: () => void
  onCancel: () => void
  starting: boolean
}

function StartConfirmModal({ examTitle, durationMinutes, totalQuestions, onConfirm, onCancel, starting }: StartModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-teal-100 text-xs font-medium uppercase tracking-wide">Ready to start the exam?</p>
              <h2 className="text-white font-bold text-lg leading-tight line-clamp-2">{examTitle}</h2>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-5">
          <div className="flex gap-4 mb-5">
            <div className="flex-1 bg-teal-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-teal-700">{durationMinutes}</p>
              <p className="text-xs text-teal-600 font-medium">Minutes</p>
            </div>
            <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{totalQuestions}</p>
              <p className="text-xs text-blue-600 font-medium">Questions</p>
            </div>
          </div>

          {/* Warnings */}
          <div className="space-y-2.5 mb-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-amber-800 mb-1.5">⚠️ Before you start:</p>
              <ul className="space-y-3 text-[13.5px] text-amber-900/80">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold flex-shrink-0">•</span>
                  <span>විභාග කාලය දැන් ආරම්භ වන අතර, එය <strong>අතරමඟ නැවැත්විය නොහැක (Pause)</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold flex-shrink-0">•</span>
                  <span>ඔබ වෙනත් පිටුවකට (tab) ගියහොත් හෝ බ්‍රවුසරය කුඩා කළහොත් (minimize) එය <strong>නීති උල්ලංඝනය කිරීමක් ලෙස සලකා</strong> ඔබගේ පිළිතුරු ඉවත් කරනු ලැබේ.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold flex-shrink-0">•</span>
                  <span>විභාග කාලය අවසන් වූ පසු ඔබගේ පිළිතුරු පත්‍රය <strong>ස්වයංක්‍රීයව එක් කරනු ලැබේ (Submit)</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold flex-shrink-0">•</span>
                  <span>ඔබට 85% ට වඩා ලකුණු ලබා ගන්නා තෙක් මෙම විභාගය සඳහා <strong>අවශ්‍ය ඕනෑම වාර ගණනක් (Attempts)</strong> පෙනී සිටිය හැකිය.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold flex-shrink-0">•</span>
                  <span>තිර රූ (Screenshots) හෝ තිර පටිගත කිරීම් (Screen recordings) සිදු කිරීමට <strong>අවසර නැත</strong>.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={starting}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
            >
              I'll do it later
            </button>
            <button
              onClick={onConfirm}
              disabled={starting}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {starting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Starting...
                </>
              ) : (
                <>විභාගය ආරම්භ කරන්න →</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Submit Confirmation Dialog ───────────────────────────────────────────────

interface SubmitDialogProps {
  unanswered: number
  onConfirm: () => void
  onCancel: () => void
  submitting: boolean
}

function SubmitConfirmDialog({ unanswered, onConfirm, onCancel, submitting }: SubmitDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Submit Answer Sheet?</h2>
        {unanswered > 0 ? (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
            ඔබ ප්‍රශ්න <strong>{unanswered}</strong> කට පිළිතුරු සපයා නොමැත. එම ප්‍රශ්න වැරදි පිළිතුරු ලෙස ගණන් ගනු ලැබේ.
          </p>
        ) : (
          <p className="text-sm text-gray-500 mb-5">ඔබ සියලුම ප්‍රශ්න සඳහා පිළිතුරු සපයා ඇත. පිළිතුරු පත්‍රය එක් කරන්නද?</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-sm"
          >
            Review Answers
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors text-sm disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Paper'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

function StudentExamPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = params?.examId as string
  const viewResults = searchParams?.get('view') === 'results'
  const dispatch = useAppDispatch()

  const { user } = useAppSelector((state) => state.auth)
  const { currentAttempt: examData, studentLoading: loading, studentError: error } = useAppSelector((state) => state.exams)

  // Phase control
  const [phase, setPhase] = useState<'loading' | 'confirm' | 'starting' | 'ongoing' | 'result' | 'locked'>('loading')
  const [mounted, setMounted] = useState(false)

  // Exam metadata displayed in the start modal (fetched from the exam enrollment card)
  // We pass it via router state or fall back to what we know from the URL.
  // The actual data comes after startExam is called.
  const [previewMeta, setPreviewMeta] = useState<{ title: string; duration: number; total: number } | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<studentApi.SubmitExamResponse | null>(null)
  const [loadingPastResult, setLoadingPastResult] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | null>>({})
  const [isPageVisible, setIsPageVisible] = useState(true)
  const [visibilityWarnings, setVisibilityWarnings] = useState(0)
  const [notStartedYet, setNotStartedYet] = useState<{ scheduledStart: string; message: string } | null>(null)
  const [lockedExamData, setLockedExamData] = useState<{ message: string; reason?: string } | null>(null)
  const [statusModal, setStatusModal] = useState<{ title: string; message: string; type: 'info' | 'error' | 'warning' | 'success'; onConfirm?: () => void } | null>(null)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)

  const autoSubmitTriggered = useRef(false)
  const answersRef = useRef(answers)
  const resultRef = useRef<HTMLDivElement>(null)
  useEffect(() => { answersRef.current = answers }, [answers])

  const [isCapturing, setIsCapturing] = useState(false)

  const downloadPDF = async () => {
    if (!resultRef.current || isCapturing || !result) return
    setIsCapturing(true)
    await new Promise(r => setTimeout(r, 100)) // wait for re-render to hide iframes
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
      const sections = Array.from(resultRef.current.querySelectorAll('[data-pdf-section]')) as HTMLElement[]

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
      const scorePct = Math.floor((result.marks_obtained / result.total_questions) * 100)
      const title = result.ranking?.exam_title || 'Exam Results'
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

      pdf.save(`exam-results-${examId}.pdf`)
    } finally {
      setIsCapturing(false)
    }
  }

  // ── Prefetch exam metadata for the modal ─────────────────────────────────
  const { currentCourseExams } = useAppSelector((state) => state.courses)
  useEffect(() => {
    setMounted(true)
    if (!examId) return

    // 1. Check if we're just viewing results
    if (viewResults) {
      setLoadingPastResult(true)
      dispatch(fetchLastAttempt(examId)).then((resAction) => {
        if (fetchLastAttempt.fulfilled.match(resAction) && resAction.payload) {
          setResult(resAction.payload)
          setPhase('result')
        } else {
          setPhase('confirm')
        }
        setLoadingPastResult(false)
      })
      return
    }

    // 2. Check if there's an ongoing attempt in localStorage — if so, resume directly
    const ongoing = getOngoingExam(examId)
    if (ongoing) {
      setPreviewMeta({ title: ongoing.examTitle, duration: ongoing.durationMinutes, total: ongoing.totalQuestions })
      handleStartExam()
      return
    }

    // 3. Check for lock status
    const initialCheck = async () => {
      // First try cache
      const cached = currentCourseExams.find((e) => e.id === examId)
      if (cached) {
        setPreviewMeta({ title: cached.title, duration: cached.duration_minutes, total: cached.total_questions })
        if (cached.is_locked) {
          setLockedExamData({ 
            message: String(cached.lock_message || 'මෙම විභාග පටිපාටිය අවහිර කර ඇත.'), 
            reason: String(cached.lock_reason || '') 
          })
          setPhase('locked')
          return
        }
      }

      // If not in cache or cached as unlocked, do a fresh API check to be sure (and get meta)
      try {
        const accessAction = await dispatch(checkExamAccess(examId))
        if (checkExamAccess.fulfilled.match(accessAction)) {
          const access = accessAction.payload
          setPreviewMeta({ 
            title: access.exam.title, 
            duration: access.exam.duration_minutes, 
            total: access.exam.total_questions 
          })
          
          if (access.is_locked) {
            setLockedExamData({ 
              message: String(access.lock_message || 'මෙම විභාග පටිපාටිය අවහිර කර ඇත.'), 
              reason: String(access.lock_reason || '') 
            })
            setPhase('locked')
            return
          }
        }
      } catch (err) {
        console.error('Failed to check exam access:', err)
      }

      setPhase('confirm')
    }

    initialCheck()
  }, [examId, currentCourseExams]) 

  // ── Start Exam (called after modal confirm) ──────────────────────────────
  const handleStartExam = useCallback(async () => {
    setPhase('starting')
    try {
      const action = await dispatch(startExam(examId))

      if (startExam.fulfilled.match(action)) {
        const data = action.payload
        const initialAnswers: Record<string, string | null> = {}
        data.questions.forEach((q) => { initialAnswers[q.id] = null })
        setAnswers(initialAnswers)
        const end = new Date(data.ends_at).getTime()
        setTimeLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)))
        setPhase('ongoing')

        // Persist to localStorage so listing pages can show ONGOING status
        saveOngoingExam({
          examId,
          attemptId: data.attempt_id,
          endsAt: data.ends_at,
          examTitle: data.exam_title,
          durationMinutes: Math.round((new Date(data.ends_at).getTime() - Date.now()) / 60000),
          totalQuestions: data.questions.length,
        })
        // Keep previewMeta in sync (useful if it wasn't cached before)
        setPreviewMeta({ title: data.exam_title, duration: 0, total: data.questions.length })

      } else if (startExam.rejected.match(action)) {
        const payload = (action as any).payload
        if (payload?.alreadyAttempted) {
          setLoadingPastResult(true)
          try {
            const resAction = await dispatch(fetchLastAttempt(examId))
            if (fetchLastAttempt.fulfilled.match(resAction) && resAction.payload) {
              setResult(resAction.payload)
              setPhase('result')
            }
          } finally {
            setLoadingPastResult(false)
          }
        } else if (payload?.notStartedYet) {
          setNotStartedYet({ 
            scheduledStart: String(payload.scheduledStart || ''), 
            message: String(payload.message || 'Exam not open yet') 
          })
          setPhase('confirm')
        } else if (payload?.isLocked) {
           setLockedExamData({ 
             message: String(payload.message || 'This exam is locked.'), 
             reason: String(payload.reason || '') 
           })
           setPhase('locked')
        } else {
          // General errors
          setStatusModal({
            title: 'Failed to Start',
            message: (typeof payload === 'string' ? payload : (payload as any)?.message) || 'Failed to start exam. Please try again.',
            type: 'error'
          })
          setPhase('confirm')
        }
      }
    } catch (err) {
      console.error('Failed to start exam:', err)
      setPhase('confirm')
    }
  }, [examId, dispatch])

  // ── Tab / Visibility handling (desktop only) ──────────────────────────────
  useEffect(() => {
    if (phase !== 'ongoing' || result) return

    const mobile = isMobileDevice()

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // On mobile, the screen turning off triggers visibilitychange.
        // We intentionally do NOT penalise mobile users for that.
        if (mobile) return

        setIsPageVisible(false)
        setVisibilityWarnings((prev) => prev + 1)
        if (examData) studentApi.reportViolation(examData.attempt_id, 'tab_switch')
        // Clear answers on desktop tab-switch — answers remain wiped when they return
        setAnswers((prev) => {
          const cleared: Record<string, string | null> = {}
          Object.keys(prev).forEach((k) => (cleared[k] = null))
          return cleared
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setIsPageVisible(true)
      }
    }

    const preventScreenshot = (e: KeyboardEvent) => {
      if (
        (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) ||
        e.key === 'PrintScreen' ||
        (e.metaKey && e.key === 'p')
      ) {
        e.preventDefault()
        setStatusModal({
          title: '🚨 Rule Violation Detected!',
          message: 'තිර රූ (Screenshots) හෝ තිර පටිගත කිරීම් (Screen recordings) සිදු කිරීමට අවසර නැත! දඬුවමක් ලෙස ඔබගේ පිළිතුරු ඉවත් කර ඇත.',
          type: 'error'
        })
        setVisibilityWarnings((prev) => prev + 1)
        if (examData) studentApi.reportViolation(examData.attempt_id, 'other', 'screenshot_attempt')
        setAnswers((prev) => {
          const cleared: Record<string, string | null> = {}
          Object.keys(prev).forEach((k) => (cleared[k] = null))
          return cleared
        })
      }
    }

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('keydown', preventScreenshot)
    document.addEventListener('contextmenu', preventContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('keydown', preventScreenshot)
      document.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [phase, result, examData])

  // ── Countdown timer & auto-submit ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ongoing' || !examData || result) return

    const interval = setInterval(() => {
      const end = new Date(examData.ends_at).getTime()
      const seconds = Math.max(0, Math.floor((end - Date.now()) / 1000))
      setTimeLeft(seconds)

      if (seconds === 0 && !autoSubmitTriggered.current) {
        autoSubmitTriggered.current = true
        clearInterval(interval)
        handleSubmit(true)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [phase, examData, result])

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (auto = false) => {
    if (!examData || submitting || result) return

    try {
      setSubmitting(true)
      const payload: studentApi.SubmitExamRequest = {
        answers: examData.questions.map((q) => ({
          question_id: q.id,
          selected_option_id: answersRef.current[q.id] || null,
        })),
      }

      const action = await dispatch(submitExamAttempt({ attemptId: examData.attempt_id, payload }))
      if (submitExamAttempt.fulfilled.match(action)) {
        clearOngoingExam(examId)  // ← remove from localStorage on successful submit
        setResult(action.payload)
        setPhase('result')
        dispatch(markExamAttempted({
          examId,
          score: action.payload.marks_obtained,
          total: action.payload.total_questions,
        }))
      } else if (auto) {
        // Even on failure, clear — they can't continue after time expiry
        clearOngoingExam(examId)
        setStatusModal({
          title: 'Auto-Submit Error',
          message: 'Time is up but we could not auto-submit your answers. Please click "Submit Paper" to save your progress.',
          type: 'warning'
        })
      }
    } catch (err) {
      console.error('Submit failed:', err)
    } finally {
      setSubmitting(false)
      setShowSubmitDialog(false)
    }
  }

  const unansweredCount = useMemo(() => {
    if (!examData) return 0
    return examData.questions.filter((q) => !answers[q.id]).length
  }, [answers, examData])

  const handleSelect = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
  }

  const getOptionForQuestion = (questionId: string, optionId: string | null) => {
    if (!optionId) return null
    if (examData) {
      const question = examData.questions.find((q) => q.id === questionId)
      if (question) return question.options.find((o) => o.id === optionId) || null
    }
    if (result) {
      const item = (result.review as any[]).find((r: any) => r.question_id === questionId)
      if (item?.options) return item.options.find((o: any) => o.id === optionId) || null
    }
    return null
  }

  // ── Render: "not open yet" ─────────────────────────────────────────────
  if (notStartedYet) {
    const opensAt = new Date(notStartedYet.scheduledStart)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-orange-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Exam not started yet</h2>
          <p className="text-gray-500 mb-4">{notStartedYet.message}</p>
          <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 mb-6">
            <p className="text-sm text-orange-700 font-semibold">
              Starts at: {opensAt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-sm text-orange-600">
              Time: {opensAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-black transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    )
  }

  // ── Render: loading ───────────────────────────────────────────────────────
  // Guard: never show the loading spinner while the exam is ongoing (submission triggers Redux loading too)
  if ((!mounted || phase === 'loading' || loading || loadingPastResult) && phase !== 'ongoing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">
            {loadingPastResult ? 'Fetching your previous results...' : (phase === 'loading' ? 'Checking exam status...' : 'Starting exam...')}
          </p>
        </div>
      </div>
    )
  }

  // ── Render: error ────────────────────────────────────────────────────────
  if (error && !examData && !result && phase !== 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {typeof error === 'string' ? error : 'An error occurred. Please try again.'}
        </div>
      </div>
    )
  }

  // ── Render: result screen ──────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const scorePct = Math.floor((result.marks_obtained / result.total_questions) * 100)
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top action bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">Exam Results</h1>
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
          </div>
        </div>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div ref={resultRef} className="space-y-4 sm:space-y-6">
            <div data-pdf-section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Exam Results</h1>
              <p className="text-4xl sm:text-5xl font-extrabold text-teal-600 mb-4">
                {scorePct}%
              </p>
              <p className="text-base sm:text-lg text-gray-800 mb-2">
                Marks Obtained: <span className="font-bold">{result.marks_obtained} / {result.total_questions}</span>
              </p>
              <p className="text-sm sm:text-base text-gray-700 mb-1">Time Taken: {formatTime(result.time_taken_seconds)}</p>
              <p className="text-sm sm:text-base text-gray-700">
                {result.ranking.exam_title} | Overall Rank:{' '}
                <span className="font-semibold">{result.ranking.overall_rank ?? '-'}</span>{' '}
                | District Rank:{' '}
                <span className="font-semibold">{result.ranking.district_rank ?? '-'}</span>
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Review Answers</h2>
              <div className="space-y-3 sm:space-y-4">
                {result.review.map((item: any, idx: number) => {
                  const selected = getOptionForQuestion(item.question_id, item.selected_option_id)
                  const correct = getOptionForQuestion(item.question_id, item.correct_option_id)
                  return (
                    <div data-pdf-section key={item.question_id} className={`border rounded-lg p-3 sm:p-4 ${item.is_correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <p className="text-sm sm:text-base font-medium text-gray-900 mb-2">{idx + 1}. {item.question_text}</p>
                      <p className={`text-xs sm:text-sm mb-1 font-semibold ${item.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                        {item.is_correct ? '✓ Correct' : '✗ Incorrect'}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-700 break-words">
                        Your Answer: {selected ? `${optionLabel(selected.order_number)}. ${selected.option_text || ''}` : 'Not answered'}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-700 break-words">
                        Correct Answer: {correct ? `${optionLabel(correct.order_number)}. ${correct.option_text || ''}` : '-'}
                      </p>
                      {item.explanation && (
                        <p className="text-xs sm:text-sm text-gray-600 mt-2 break-words">
                          <span className="font-medium">Explanation:</span> {item.explanation}
                        </p>
                      )}
                      {item.video_url && (
                        isCapturing ? (
                          <p className="text-xs text-gray-600 mt-2">Watch: <span className="text-teal-700">{item.video_url}</span></p>
                        ) : (
                          <div className="mt-3 aspect-video w-full max-w-md">
                            <iframe
                              width="100%"
                              height="100%"
                              src={getYouTubeEmbedUrl(item.video_url)}
                              title="Explanation Video"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="rounded-lg shadow-sm"
                            ></iframe>
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full sm:w-auto px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-black text-center"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                const cid = result?.ranking?.course_id
                if (cid && cid !== 'undefined') {
                  router.push(`/student/courses/${cid}`)
                } else {
                  router.push('/student/courses')
                }
              }}
              className="w-full sm:w-auto px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center"
            >
              Back to Course
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Render: start confirmation modal ──────────────────────────────────────
  if (phase === 'confirm' || phase === 'starting') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <StartConfirmModal
          examTitle={previewMeta?.title ?? 'Exam'}
          durationMinutes={previewMeta?.duration ?? 0}
          totalQuestions={previewMeta?.total ?? 0}
          onConfirm={handleStartExam}
          onCancel={() => router.back()}
          starting={phase === 'starting'}
        />
      </div>
    )
  }

  // ── Render: locked modal ────────────────────────────────────────────────
  if (phase === 'locked' && lockedExamData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <StatusModal
          title="Exam Protocol Blocked"
          message={lockedExamData.message}
          type="warning"
          onConfirm={() => router.back()}
          buttonText="Go Back"
        />
      </div>
    )
  }

  // ── Render: submitting full-page loader ──────────────────────────────────
  if (submitting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin mx-auto mb-5" />
          <h2 className="text-xl font-bold text-gray-800 mb-1">Submitting Paper...</h2>
          <p className="text-sm text-gray-500">Please wait. Do not close this page.</p>
        </div>
      </div>
    )
  }

  // ── Render: exam ongoing ──────────────────────────────────────────────────
  if (!examData) return null

  return (
    <>
      <style jsx>{`
        @media print { body { display: none !important; } }
        * {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
      `}</style>

      {/* Submit confirm dialog */}
      {showSubmitDialog && (
        <SubmitConfirmDialog
          unanswered={unansweredCount}
          onConfirm={() => handleSubmit(false)}
          onCancel={() => setShowSubmitDialog(false)}
          submitting={submitting}
        />
      )}

      {/* Status modal replacement for alert() */}
      {statusModal && (
        <StatusModal
          title={statusModal.title}
          message={statusModal.message}
          type={statusModal.type}
          onConfirm={() => {
            if (statusModal.onConfirm) statusModal.onConfirm()
            setStatusModal(null)
          }}
        />
      )}

      <div className="min-h-screen bg-gray-50 select-none">
        {/* Watermark overlay */}
        {user && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            <div className="absolute inset-0 flex flex-col justify-between py-8">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex justify-between px-8">
                  {[...Array(4)].map((_, j) => (
                    <div
                      key={j}
                      className="text-gray-400/20 text-xs font-mono transform -rotate-45"
                      style={{ userSelect: 'none' }}
                    >
                      {user.email} • {user.id?.slice(0, 8)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Violation overlay (desktop tab-switch) */}
        {!isPageVisible && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 text-center max-w-md mx-4 shadow-2xl">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">⚠️ නීති උල්ලංඝනය කිරීමක් හඳුනා ගන්නා ලදී!</h2>
              <p className="text-gray-800 mb-3 font-semibold">ඔබ විභාගය අතරතුර වෙනත් පිටුවකට පිවිසීමට උත්සාහ කර ඇත.</p>
              <p className="text-gray-600 text-sm mb-2">දඬුවමක් ලෙස ඔබගේ පිළිතුරු ඉවත් කර ඇති අතර, විභාග කාලය තවමත් ගණනය වෙමින් පවතී.</p>
              <p className="text-sm font-bold text-red-500 bg-red-50 border border-red-100 py-2 px-4 rounded-lg inline-block">
                නීති උල්ලංඝනය කිරීම් ප්‍රමාණය: {visibilityWarnings}
              </p>
              <p className="text-xs text-gray-400 mt-3">නැවත ආරම්භ කිරීමට විභාගයේ ඕනෑම තැනක ක්ලික් කරන්න.</p>
            </div>
          </div>
        )}

        <main
          className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8"
          onCopy={(e) => e.preventDefault()}
          onClick={() => { if (!isPageVisible) setIsPageVisible(true) }}
        >
          {/* Floating Timer */}
          <div className="fixed top-4 sm:top-8 right-4 sm:right-8 z-50">
            <div className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-lg border font-bold text-lg sm:text-xl backdrop-blur-sm transition-colors ${
              timeLeft <= 60
                ? 'bg-red-50/95 border-red-300 text-red-700 animate-pulse'
                : timeLeft <= 300
                ? 'bg-amber-50/95 border-amber-200 text-amber-700'
                : 'bg-white/95 border-gray-200 text-gray-800'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Header bar */}
          <div className="bg-white border-b border-gray-200 shadow-sm -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 sm:py-3 mb-4 sm:mb-6">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold text-gray-900 truncate">{examData.exam_title}</h1>
                <p className="text-xs text-gray-600">
                  {examData.subject} •{' '}
                  <span className={unansweredCount > 0 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>
                    {unansweredCount > 0 ? `${unansweredCount} unanswered` : 'All answered ✓'}
                  </span>
                </p>
              </div>
              {visibilityWarnings > 0 && (
                <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full font-semibold flex-shrink-0">
                  ⚠️ {visibilityWarnings} rule violations detected
                </span>
              )}
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-6">
            {examData.questions.map((question, index) => (
              <div key={question.id} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                <div className={question.question_image_url ? 'flex flex-col lg:flex-row gap-4 lg:gap-6' : ''}>
                  <div className={question.question_image_url ? 'flex-1 order-2 lg:order-1' : ''}>
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                      {index + 1}. {question.question_text}
                    </h2>
                    <div className="space-y-2">
                      {question.options.map((option) => (
                        <label
                          key={option.id}
                          className={`flex items-start gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                            answers[question.id] === option.id
                              ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            checked={answers[question.id] === option.id}
                            onChange={() => handleSelect(question.id, option.id)}
                            className="mt-1 flex-shrink-0 accent-teal-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${answers[question.id] === option.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                {optionLabel(option.order_number)}
                              </span>
                            </div>
                            {option.option_text && <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{option.option_text}</p>}
                            {option.option_image_url && (
                              <div className="mt-2 w-full max-w-full overflow-hidden flex justify-center bg-white rounded-lg border border-gray-100 p-2">
                                <img
                                  src={option.option_image_url}
                                  alt="Option"
                                  className="max-h-40 sm:max-h-48 w-auto object-contain pointer-events-none"
                                  draggable="false"
                                  onContextMenu={(e) => e.preventDefault()}
                                />
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {question.question_image_url && (
                    <div className="w-full lg:w-80 flex-shrink-0 order-1 lg:order-2">
                      <div className="bg-white rounded-xl border border-gray-100 p-2 shadow-sm">
                        <img
                          src={question.question_image_url}
                          alt={`Question ${index + 1}`}
                          className="w-full h-auto rounded-lg lg:sticky lg:top-32 pointer-events-none max-h-80 sm:max-h-96 lg:max-h-[500px] object-contain mx-auto"
                          draggable="false"
                          onContextMenu={(e) => e.preventDefault()}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Submit button */}
          <div className="mt-6 sm:mt-8 flex justify-center px-4 pb-8">
            <button
              onClick={() => setShowSubmitDialog(true)}
              disabled={submitting || timeLeft === 0}
              className="w-full sm:w-auto px-6 sm:px-10 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 font-semibold text-base sm:text-lg shadow-lg transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Paper'}
            </button>
          </div>
        </main>
      </div>
    </>
  )
}

export default function StudentExamPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <StudentExamPageContent />
    </Suspense>
  )
}

function getYouTubeEmbedUrl(url: string | null | undefined): string {
  if (!url) return ''
  let videoId = ''
  
  if (url.includes('youtube.com/watch?v=')) {
    const parts = url.split('v=')
    if (parts.length > 1) {
      videoId = parts[1].split('&')[0]
    }
  } else if (url.includes('youtu.be/')) {
    const parts = url.split('youtu.be/')
    if (parts.length > 1) {
      videoId = parts[1].split('?')[0]
    }
  } else if (url.includes('youtube.com/embed/')) {
    const parts = url.split('embed/')
    if (parts.length > 1) {
      videoId = parts[1].split('?')[0]
    }
  }
  
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url
}
