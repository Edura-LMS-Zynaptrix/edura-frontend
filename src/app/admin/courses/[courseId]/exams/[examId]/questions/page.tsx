'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchQuestions, createQuestion, updateQuestion, deleteQuestion } from '@/lib/redux/slices/questionsSlice'
import { getErrorMessage } from '@/lib/utils'

interface OptionForm {
  option_text: string
  is_correct: boolean
}

const emptyOptions = (): OptionForm[] => [
  { option_text: '', is_correct: true },
  { option_text: '', is_correct: false },
]

export default function AdminExamQuestionsPage() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const courseId = params?.courseId as string
  const examId = params?.examId as string

  const { user, isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth)
  const { questions, isLoading: loadingQuestions, error: storeError } = useAppSelector((state) => state.questions)

  const [localError, setLocalError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)

  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState<OptionForm[]>(emptyOptions())

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
    if (isAuthenticated && user && examId) {
      dispatch(fetchQuestions(examId))
    }
  }, [isAuthenticated, isInitialized, user, dispatch, router, pathname, isLoading, searchParams, examId])

  const openCreateModal = () => {
    setLocalError('')
    setQuestionText('')
    setOptions(emptyOptions())
    setShowCreateModal(true)
  }

  const openEditModal = (q: any) => {
    setLocalError('')
    setQuestionText(q.question_text)
    setOptions(
      q.options.length > 0
        ? q.options.map((o: any) => ({ option_text: o.option_text || '', is_correct: o.is_correct }))
        : emptyOptions()
    )
    setEditingQuestionId(q.id)
  }

  const closeModal = () => {
    setShowCreateModal(false)
    setEditingQuestionId(null)
    setLocalError('')
  }

  const addOption = () => setOptions((prev) => [...prev, { option_text: '', is_correct: false }])
  const removeOption = (idx: number) => setOptions((prev) => prev.filter((_, i) => i !== idx))
  const setOptionText = (idx: number, text: string) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, option_text: text } : o)))
  const setCorrectOption = (idx: number) =>
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = questionText.trim()
    if (!text) { setLocalError('Please enter the question text'); return }
    const filledOptions = options.filter((o) => o.option_text.trim())
    if (filledOptions.length < 2) { setLocalError('Please provide at least 2 options'); return }
    if (!filledOptions.some((o) => o.is_correct)) { setLocalError('Please mark one option as correct'); return }

    try {
      setLocalError('')
      setIsSaving(true)
      const optionData = filledOptions.map((o, idx) => ({
        option_text: o.option_text.trim(),
        is_correct: o.is_correct,
        order_number: idx,
      }))

      if (editingQuestionId) {
        await dispatch(updateQuestion({
          id: editingQuestionId,
          data: { question_text: text, options: optionData, order_number: questions.length },
        })).unwrap()
      } else {
        await dispatch(createQuestion({
          exam_id: examId,
          question_text: text,
          options: optionData,
          order_number: questions.length,
        })).unwrap()
      }
      closeModal()
    } catch (err: any) {
      setLocalError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (q: any) => {
    if (!window.confirm('Delete this question?')) return
    try {
      setLocalError('')
      await dispatch(deleteQuestion(q.id)).unwrap()
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

  const modalOpen = showCreateModal || !!editingQuestionId

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Question Management</h1>
            <p className="text-xs text-gray-500">Exam #{examId}</p>
          </div>
          <Link href={`/admin/courses/${courseId}/exams`} className="px-4 py-2 text-sm text-teal-700 hover:bg-teal-50 rounded-lg">
            Back to Exams
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && !modalOpen && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Questions ({questions.length})</h2>
          <button onClick={openCreateModal} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
            + Add Question
          </button>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          {loadingQuestions ? (
            <p className="text-sm text-gray-500">Loading questions...</p>
          ) : questions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No questions yet</p>
              <button onClick={openCreateModal} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                Add your first question
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {questions.map((q: any, idx: number) => (
                <div key={q.id} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {idx + 1}. {q.question_text}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {q.options.map((o: any) => (
                          <li
                            key={o.id}
                            className={`text-xs px-2 py-1 rounded ${o.is_correct ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-500'}`}
                          >
                            {o.is_correct ? '✓ ' : '○ '}{o.option_text}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => openEditModal(q)} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(q)} className="px-3 py-1.5 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200">
                        Delete
                      </button>
                    </div>
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
              <h2 className="text-xl font-semibold text-gray-900">{editingQuestionId ? 'Edit Question' : 'Add Question'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Question text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={2}
                required
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Options (select the correct one)</label>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct_option"
                      checked={opt.is_correct}
                      onChange={() => setCorrectOption(idx)}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500 shrink-0"
                    />
                    <input
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder={`Option ${idx + 1}`}
                      value={opt.option_text}
                      onChange={(e) => setOptionText(idx, e.target.value)}
                    />
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(idx)} className="text-gray-400 hover:text-red-600 shrink-0">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addOption} className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                  + Add another option
                </button>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {isSaving ? 'Saving...' : editingQuestionId ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
