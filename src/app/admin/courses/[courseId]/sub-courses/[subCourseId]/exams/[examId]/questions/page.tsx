'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchCourses } from '@/lib/redux/slices/coursesSlice'
import { fetchExams } from '@/lib/redux/slices/examsSlice'
import { fetchQuestions, createQuestion, updateQuestion, deleteQuestion, importQuestionsCSV } from '@/lib/redux/slices/questionsSlice'
import { uploadImageThunk, deleteImageThunk } from '@/lib/redux/slices/coursesSlice'
import { getErrorMessage } from '@/lib/utils'
import { uploadQuestionImagesZip, type ZipUploadResult } from '@/lib/api/admin'

type Course = {
  id: string
  title: string
  subject: string
  grade: number
}

type Exam = {
  id: string
  course_id: string
  title: string
  total_questions: number
}

function optionLabel(order: number): string {
  return String.fromCharCode(64 + order)
}

type QuestionOption = {
  id?: string
  option_text: string | null
  option_image_url: string | null
  option_image_public_id: string | null
  is_correct: boolean
  order_number: number
}

type Question = {
  id: string
  exam_id: string
  question_text: string
  question_image_url: string | null
  question_image_public_id: string | null
  explanation: string | null
  video_url: string | null
  order_number: number
  options: QuestionOption[]
}

export default function QuestionsPage() {
  const params = useParams<{ courseId: string; subCourseId: string; examId: string }>()
  const { courseId, subCourseId, examId } = params
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth)
  const { courses } = useAppSelector((state) => state.courses)
  const { exams } = useAppSelector((state) => state.exams)
  const { questions, isLoading: loadingData, error: storeError } = useAppSelector((state) => state.questions)

  // Derive course and exam directly from Redux state
  const course = courses.find((c) => c.id === courseId) || null
  const exam = exams.find((e) => e.id === examId) || null

  const [localError, setLocalError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showAnswers, setShowAnswers] = useState(true)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  
  const error = storeError || localError
  
  // Helper function to get number of options based on grade
  const getNumOptions = () => {
    if (!course) return 4 // Default to 4 options
    if (course.grade === 5) return 3
    return course.grade >= 12 ? 5 : 4
  }
  
  // Helper function to create empty options array
  const createEmptyOptions = (numOptions: number = 4) => {
    return Array.from({ length: numOptions }, (_, idx) => ({
      option_text: '',
      option_image_url: '',
      option_image_public_id: '',
      is_correct: false,
      order_number: idx + 1,
    }))
  }
  
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    question_image_url: '',
    question_image_public_id: '',
    explanation: '',
    video_url: '',
    options: createEmptyOptions(4)
  })

  const [questionImageFile, setQuestionImageFile] = useState<File | null>(null)
  const [optionImageFiles, setOptionImageFiles] = useState<{ [key: number]: File | null }>({})
  const [csvFile, setCsvFile] = useState<File | null>(null)

  // ZIP image upload state
  const [showZipModal, setShowZipModal] = useState(false)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [zipUploading, setZipUploading] = useState(false)
  const [zipResult, setZipResult] = useState<ZipUploadResult | null>(null)
  const [removeQuestionImage, setRemoveQuestionImage] = useState(false)
  const [removeOptionImages, setRemoveOptionImages] = useState<{ [key: number]: boolean }>({})

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

    if (isAuthenticated && user && user.role !== 'admin' && user.role !== 'super_admin') {
      router.push('/')
      return
    }

    if (isAuthenticated && user) {
      // Load data
      if (courses.length === 0) {
        dispatch(fetchCourses())
      }
      
      if (exams.length === 0) {
        dispatch(fetchExams(courseId))
      }

      // Load questions for this exam
      dispatch(fetchQuestions(examId))
    }
  }, [isInitialized, isAuthenticated, user, dispatch, router, courseId, examId, pathname, isLoading, courses.length, exams.length, searchParams])

  const uploadQuestionImage = async (file: File) => {
    const resultAction = await dispatch(uploadImageThunk({ file, entity: 'questions' }))
    if (uploadImageThunk.fulfilled.match(resultAction)) {
      return {
        image_url: resultAction.payload.image_url,
        image_public_id: resultAction.payload.image_public_id,
      }
    } else {
      throw new Error(resultAction.payload as string || 'Image upload failed')
    }
  }

  const deleteImageFromCloudinary = async (publicId: string | null | undefined) => {
    if (!publicId) return
    try {
      await dispatch(deleteImageThunk(publicId))
    } catch (err: any) {
      console.error('Failed to delete image from Cloudinary:', err)
    }
  }

  const handleCreateQuestion = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setLocalError('')
      setSuccess('')
      setIsCreating(true)

      // Validate question text
      const questionText = questionForm.question_text.trim()
      if (!questionText) {
        setLocalError('Please enter question text')
        setIsCreating(false)
        return
      }

      // Validate options
      const validOptions = questionForm.options.filter(opt => opt.option_text.trim())
      if (validOptions.length < 2) {
        setLocalError('Please provide at least 2 options')
        setIsCreating(false)
        return
      }

      // Validate correct answer
      const correctOptions = questionForm.options.filter(opt => opt.is_correct)
      if (correctOptions.length !== 1) {
        setLocalError('Please select exactly one correct answer')
        setIsCreating(false)
        return
      }

      // Upload question image if provided
      let questionImageUrl = questionForm.question_image_url
      let questionImagePublicId = questionForm.question_image_public_id

      if (questionImageFile) {
        try {
          const result = await uploadQuestionImage(questionImageFile)
          questionImageUrl = result.image_url
          questionImagePublicId = result.image_public_id
        } catch (err: any) {
          setLocalError('Failed to upload question image')
          setIsCreating(false)
          return
        }
      }

      // Upload option images if provided
      const optionsWithImages = await Promise.all(
        questionForm.options.map(async (opt, idx) => {
          if (optionImageFiles[idx]) {
            try {
              const result = await uploadQuestionImage(optionImageFiles[idx]!)
              return {
                ...opt,
                option_image_url: result.image_url,
                option_image_public_id: result.image_public_id,
              }
            } catch (err) {
              console.error(`Failed to upload image for option ${idx + 1}`)
              return opt
            }
          }
          return opt
        })
      )

      // Prepare payload
      const payload = {
        exam_id: examId,
        question_text: questionText,
        question_image_url: questionImageUrl,
        question_image_public_id: questionImagePublicId,
        explanation: questionForm.explanation.trim() || null,
        video_url: questionForm.video_url.trim() || null,
        order_number: questions.length + 1,
        options: optionsWithImages.filter(opt => opt.option_text.trim()).map(opt => ({
          option_text: opt.option_text.trim() || null,
          option_image_url: opt.option_image_url || null,
          option_image_public_id: opt.option_image_public_id || null,
          is_correct: opt.is_correct,
          order_number: opt.order_number,
        }))
      }

      await dispatch(createQuestion(payload)).unwrap()
      setSuccess('Question created successfully')
      closeCreateModal()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to create question')
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateQuestion = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingQuestionId) return

    try {
      setLocalError('')
      setSuccess('')
      setIsCreating(true)

      // Similar validation as create
      const questionText = questionForm.question_text.trim()
      if (!questionText) {
        setLocalError('Please enter question text')
        setIsCreating(false)
        return
      }

      const validOptions = questionForm.options.filter(opt => opt.option_text.trim())
      if (validOptions.length < 2) {
        setLocalError('Please provide at least 2 options')
        setIsCreating(false)
        return
      }

      const correctOptions = questionForm.options.filter(opt => opt.is_correct)
      if (correctOptions.length !== 1) {
        setLocalError('Please select exactly one correct answer')
        setIsCreating(false)
        return
      }

      // Upload question image if new file provided
      let questionImageUrl: string | null = questionForm.question_image_url
      let questionImagePublicId: string | null = questionForm.question_image_public_id

      // Handle question image removal
      if (removeQuestionImage) {
        // Delete from Cloudinary
        if (questionForm.question_image_public_id) {
          await deleteImageFromCloudinary(questionForm.question_image_public_id)
        }
        questionImageUrl = null
        questionImagePublicId = null
      } else if (questionImageFile) {
        try {
          const result = await uploadQuestionImage(questionImageFile)
          questionImageUrl = result.image_url
          questionImagePublicId = result.image_public_id
          
          // Delete old image if exists
          if (questionForm.question_image_public_id) {
            await deleteImageFromCloudinary(questionForm.question_image_public_id)
          }
        } catch (err: any) {
          setLocalError('Failed to upload question image')
          setIsCreating(false)
          return
        }
      }

      // Upload option images
      const optionsWithImages = await Promise.all(
        questionForm.options.map(async (opt, idx) => {
          // Handle option image removal
          if (removeOptionImages[idx]) {
            // Delete from Cloudinary
            if (opt.option_image_public_id) {
              await deleteImageFromCloudinary(opt.option_image_public_id)
            }
            return {
              ...opt,
              option_image_url: null,
              option_image_public_id: null,
            }
          } else if (optionImageFiles[idx]) {
            try {
              const result = await uploadQuestionImage(optionImageFiles[idx]!)
              
              // Delete old image if exists
              if (opt.option_image_public_id) {
                await deleteImageFromCloudinary(opt.option_image_public_id)
              }
              
              return {
                ...opt,
                option_image_url: result.image_url,
                option_image_public_id: result.image_public_id,
              }
            } catch (err) {
              console.error(`Failed to upload image for option ${idx + 1}`)
              return opt
            }
          }
          return opt
        })
      )

      const payload = {
        question_text: questionText,
        question_image_url: questionImageUrl,
        question_image_public_id: questionImagePublicId,
        explanation: questionForm.explanation.trim() || null,
        video_url: questionForm.video_url.trim() || null,
        options: optionsWithImages.filter(opt => opt.option_text.trim()).map(opt => ({
          option_text: opt.option_text.trim() || null,
          option_image_url: opt.option_image_url || null,
          option_image_public_id: opt.option_image_public_id || null,
          is_correct: opt.is_correct,
          order_number: opt.order_number,
        }))
      }

      await dispatch(updateQuestion({ id: editingQuestionId, data: payload })).unwrap()
      setSuccess('Question updated successfully')
      closeEditModal()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to update question')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteQuestion = async (question: Question) => {
    const confirmed = window.confirm(`Delete this question?`)
    if (!confirmed) return

    try {
      setLocalError('')
      setSuccess('')
      
      // Delete images
      if (question.question_image_public_id) {
        await deleteImageFromCloudinary(question.question_image_public_id)
      }
      
      question.options.forEach(opt => {
        if (opt.option_image_public_id) {
          deleteImageFromCloudinary(opt.option_image_public_id)
        }
      })
      
      await dispatch(deleteQuestion(question.id)).unwrap()
      setSuccess('Question deleted successfully')
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to delete question')
    }
  }

  const handleImportCSV = async (e: FormEvent) => {
    e.preventDefault()
    if (!csvFile) {
      setLocalError('Please select a CSV file')
      return
    }

    try {
      setLocalError('')
      setSuccess('')
      setIsCreating(true)

      const result = await dispatch(importQuestionsCSV({ examId, file: csvFile })).unwrap()
      
      let message = `✅ ${result.questions_created ?? 0} question(s) imported successfully`
      if (result.errors && result.errors.length > 0) {
        message += `\n\n⚠️ ${result.errors.length} row(s) skipped:\n` + result.errors.join('\n')
      }
      
      setSuccess(message)
      closeImportModal()
      // Re-fetch questions from server to ensure the list is up to date
      dispatch(fetchQuestions(examId))
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to import questions')
    } finally {
      setIsCreating(false)
    }
  }

  const handleZipUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!zipFile) { setLocalError('Please select a ZIP file'); return }
    setZipUploading(true)
    setLocalError('')
    setZipResult(null)
    try {
      const result = await uploadQuestionImagesZip(examId, zipFile)
      setZipResult(result)
      dispatch(fetchQuestions(examId))
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'ZIP upload failed')
    } finally {
      setZipUploading(false)
    }
  }

  const openCreateModal = () => {
    setLocalError('')
    setSuccess('')
    setQuestionForm({
      question_text: '',
      question_image_url: '',
      question_image_public_id: '',
      explanation: '',
      video_url: '',
      options: createEmptyOptions(getNumOptions())
    })
    setQuestionImageFile(null)
    setOptionImageFiles({})
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setLocalError('')
    setQuestionImageFile(null)
    setOptionImageFiles({})
  }

  const openEditModal = (question: Question) => {
    setLocalError('')
    setSuccess('')
    const numOptions = getNumOptions()
    const currentOptions = question.options.length > 0 
      ? question.options.map(opt => ({
          option_text: opt.option_text || '',
          option_image_url: opt.option_image_url || '',
          option_image_public_id: opt.option_image_public_id || '',
          is_correct: opt.is_correct,
          order_number: opt.order_number
        }))
      : createEmptyOptions(numOptions)
    
    // Ensure we have the right number of options (in case grade was different when created)
    if (currentOptions.length < numOptions) {
      const additionalOptions = createEmptyOptions(numOptions - currentOptions.length)
      additionalOptions.forEach((opt, idx) => {
        opt.order_number = currentOptions.length + idx + 1
      })
      currentOptions.push(...additionalOptions)
    } else if (currentOptions.length > numOptions) {
      currentOptions.splice(numOptions)
    }
    
    setQuestionForm({
      question_text: question.question_text,
      question_image_url: question.question_image_url || '',
      question_image_public_id: question.question_image_public_id || '',
      explanation: question.explanation || '',
      video_url: question.video_url || '',
      options: currentOptions
    })
    setQuestionImageFile(null)
    setOptionImageFiles({})
    setRemoveQuestionImage(false)
    setRemoveOptionImages({})
    setEditingQuestionId(question.id)
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setLocalError('')
    setQuestionImageFile(null)
    setOptionImageFiles({})
    setRemoveQuestionImage(false)
    setRemoveOptionImages({})
    setEditingQuestionId(null)
  }

  const openImportModal = () => {
    setLocalError('')
    setSuccess('')
    setCsvFile(null)
    setShowImportModal(true)
  }

  const closeImportModal = () => {
    setShowImportModal(false)
    setLocalError('')
    setCsvFile(null)
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-lg font-semibold">Loading...</div>
      </div>
    )
  }

  const remainingQuestions = exam ? exam.total_questions - questions.length : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Manage Questions • {exam?.title || 'Loading...'}
            </h1>
            {course && exam && (
              <p className="text-xs text-gray-500">
                {course.title} • {questions.length}/{exam.total_questions} questions created
              </p>
            )}
          </div>
          <Link 
            href={`/admin/courses/${courseId}/sub-courses/${subCourseId}/exams`} 
            className="px-4 py-2 text-sm text-teal-700 hover:bg-teal-50 rounded-lg"
          >
            Back to Exams
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm whitespace-pre-wrap">
            {success}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Questions</h2>
              <p className="text-sm text-gray-600 mt-1">
                {remainingQuestions > 0 
                  ? `${remainingQuestions} more question${remainingQuestions !== 1 ? 's' : ''} needed`
                  : 'All questions created'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreviewModal(true)}
                disabled={questions.length === 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Preview Exam
              </button>
              <button
                onClick={openImportModal}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
              >
                Import CSV
              </button>
              <button
                onClick={() => { setShowZipModal(true); setZipFile(null); setZipResult(null); setLocalError('') }}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
              >
                Upload Images ZIP
              </button>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"
              >
                + Add Question
              </button>
            </div>
          </div>

          {loadingData ? (
            <div className="text-center py-12 text-gray-500">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No questions yet. Click "Add Question" or "Import CSV" to get started.
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question, idx) => (
                <div key={question.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                  {/* Question Header */}
                  <div className="bg-gradient-to-r from-teal-50 to-blue-50 px-6 py-4 border-b border-gray-200 rounded-t-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex-shrink-0 w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-900 font-semibold text-base leading-relaxed">{question.question_text}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => openEditModal(question)}
                          className="px-4 py-2 text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(question)}
                          className="px-4 py-2 text-sm font-medium text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="p-6 space-y-4">
                    {/* Question Image */}
                    {question.question_image_url && (
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <img 
                          src={question.question_image_url} 
                          alt="Question" 
                          className="w-full max-w-sm mx-auto rounded-lg object-contain"
                          style={{ maxHeight: '180px' }}
                        />
                      </div>
                    )}

                    {/* Options */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Answer Options</p>
                      {question.options.map((opt, optIdx) => (
                        <div 
                          key={optIdx}
                          className={`relative rounded-lg border-2 transition-all ${
                            opt.is_correct 
                              ? 'border-green-500 bg-green-50' 
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="p-4">
                            <div className="flex items-start gap-3">
                              {/* Option Label */}
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                opt.is_correct 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-gray-200 text-gray-700'
                              }`}>
                                {String.fromCharCode(65 + optIdx)}
                              </div>
                              
                              {/* Option Content */}
                              <div className="flex-1 min-w-0">
                                {opt.option_text && (
                                  <p className={`text-sm leading-relaxed ${
                                    opt.is_correct ? 'font-medium text-gray-900' : 'text-gray-700'
                                  }`}>
                                    {opt.option_text}
                                  </p>
                                )}
                                {opt.option_image_url && (
                                  <div className="mt-2 bg-white rounded-lg p-2 border border-gray-200">
                                    <img 
                                      src={opt.option_image_url} 
                                      alt={`Option ${String.fromCharCode(65 + optIdx)}`}
                                      className="w-full max-w-xs rounded object-contain"
                                      style={{ maxHeight: '100px' }}
                                    />
                                  </div>
                                )}
                              </div>
                              
                              {/* Correct Badge */}
                              {opt.is_correct && (
                                <div className="flex-shrink-0">
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-600 text-white px-3 py-1.5 rounded-full shadow-sm">
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Correct
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Explanation */}
                    {(question.explanation || question.video_url) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">Explanation</p>
                            {question.explanation && (
                              <p className="text-sm text-blue-800 leading-relaxed">{question.explanation}</p>
                            )}
                            {question.video_url && (
                              <div className="mt-2 aspect-video w-full max-w-md">
                                <iframe
                                  width="100%"
                                  height="100%"
                                  src={getYouTubeEmbedUrl(question.video_url)}
                                  title="Explanation Video"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="rounded-lg shadow-sm"
                                ></iframe>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Create Question</h3>
              <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleCreateQuestion} className="p-6 space-y-6">
              {error && showCreateModal && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Text *
                </label>
                <textarea
                  value={questionForm.question_text}
                  onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  rows={3}
                  placeholder="Enter your question here"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Image (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setQuestionImageFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
                {questionImageFile && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">Preview:</p>
                    <img
                      src={URL.createObjectURL(questionImageFile)}
                      alt="Preview"
                      className="w-full max-w-sm mx-auto rounded-lg object-contain"
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Options (minimum 2 required) *
                </label>
                <div className="space-y-3">
                  {questionForm.options.map((option, idx) => (
                    <div 
                      key={idx} 
                      className={`border-2 rounded-lg p-4 transition-all ${
                        option.is_correct 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 pt-2">
                          <input
                            type="radio"
                            name="correct_answer"
                            checked={option.is_correct}
                            onChange={() => {
                              const newOptions = questionForm.options.map((opt, i) => ({
                                ...opt,
                                is_correct: i === idx
                              }))
                              setQuestionForm({ ...questionForm, options: newOptions })
                            }}
                            className="w-5 h-5 text-teal-600 cursor-pointer"
                          />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                Option Text
                              </span>
                            </label>
                            <input
                              type="text"
                              value={option.option_text}
                              onChange={(e) => {
                                const newOptions = [...questionForm.options]
                                newOptions[idx].option_text = e.target.value
                                setQuestionForm({ ...questionForm, options: newOptions })
                              }}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              placeholder={`Enter option ${String.fromCharCode(65 + idx)} text`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">
                              Option Image (Optional)
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null
                                setOptionImageFiles({ ...optionImageFiles, [idx]: file })
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                            />
                            {optionImageFiles[idx] && (
                              <div className="mt-2 bg-white rounded-lg p-2 border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">Preview:</p>
                                <img
                                  src={URL.createObjectURL(optionImageFiles[idx]!)}
                                  alt={`Option ${String.fromCharCode(65 + idx)} preview`}
                                  className="w-full max-w-xs rounded object-contain"
                                  style={{ maxHeight: '100px' }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Click the radio button next to the correct answer
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Explanation (Optional)
                </label>
                <textarea
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  rows={3}
                  placeholder="Explain the correct answer"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Question'}
                </button>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-6 py-2.5 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Question</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleUpdateQuestion} className="p-6 space-y-6">
              {error && showEditModal && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Text *
                </label>
                <textarea
                  value={questionForm.question_text}
                  onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Image
                </label>
                {questionForm.question_image_url && !questionImageFile && !removeQuestionImage && (
                  <div className="mb-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-600">Current Image:</p>
                      <button
                        type="button"
                        onClick={() => setRemoveQuestionImage(true)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove Image
                      </button>
                    </div>
                    <img 
                      src={questionForm.question_image_url} 
                      alt="Current" 
                      className="w-full max-w-sm mx-auto rounded-lg object-contain" 
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
                )}
                {removeQuestionImage && (
                  <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-red-700">Image will be removed when you save</p>
                      <button
                        type="button"
                        onClick={() => setRemoveQuestionImage(false)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Undo
                      </button>
                    </div>
                  </div>
                )}
                {questionImageFile && (
                  <div className="mb-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">New Image Preview:</p>
                    <img
                      src={URL.createObjectURL(questionImageFile)}
                      alt="Preview"
                      className="w-full max-w-sm mx-auto rounded-lg object-contain"
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
                )}
                {!removeQuestionImage && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setQuestionImageFile(e.target.files?.[0] || null)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Upload a new image to replace the current one</p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Options *
                </label>
                <div className="space-y-3">
                  {questionForm.options.map((option, idx) => (
                    <div 
                      key={idx} 
                      className={`border-2 rounded-lg p-4 transition-all ${
                        option.is_correct 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 pt-2">
                          <input
                            type="radio"
                            name="correct_answer"
                            checked={option.is_correct}
                            onChange={() => {
                              const newOptions = questionForm.options.map((opt, i) => ({
                                ...opt,
                                is_correct: i === idx
                              }))
                              setQuestionForm({ ...questionForm, options: newOptions })
                            }}
                            className="w-5 h-5 text-teal-600 cursor-pointer"
                          />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                Option Text
                              </span>
                            </label>
                            <input
                              type="text"
                              value={option.option_text || ''}
                              onChange={(e) => {
                                const newOptions = [...questionForm.options]
                                newOptions[idx].option_text = e.target.value
                                setQuestionForm({ ...questionForm, options: newOptions })
                              }}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              placeholder={`Enter option ${String.fromCharCode(65 + idx)} text`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">
                              Option Image (Optional)
                            </label>
                            {option.option_image_url && !optionImageFiles[idx] && !removeOptionImages[idx] && (
                              <div className="mb-2 bg-white rounded-lg p-2 border border-gray-200">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs text-gray-600">Current Image:</p>
                                  <button
                                    type="button"
                                    onClick={() => setRemoveOptionImages({ ...removeOptionImages, [idx]: true })}
                                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <img 
                                  src={option.option_image_url} 
                                  alt={`Option ${String.fromCharCode(65 + idx)}`} 
                                  className="w-full max-w-xs rounded object-contain" 
                                  style={{ maxHeight: '100px' }}
                                />
                              </div>
                            )}
                            {removeOptionImages[idx] && (
                              <div className="mb-2 bg-red-50 border border-red-200 rounded-lg p-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-red-700">Image will be removed</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = { ...removeOptionImages }
                                      delete updated[idx]
                                      setRemoveOptionImages(updated)
                                    }}
                                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                                  >
                                    Undo
                                  </button>
                                </div>
                              </div>
                            )}
                            {optionImageFiles[idx] && (
                              <div className="mb-2 bg-white rounded-lg p-2 border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">New Image Preview:</p>
                                <img
                                  src={URL.createObjectURL(optionImageFiles[idx]!)}
                                  alt={`Option ${String.fromCharCode(65 + idx)} preview`}
                                  className="w-full max-w-xs rounded object-contain"
                                  style={{ maxHeight: '100px' }}
                                />
                              </div>
                            )}
                            {!removeOptionImages[idx] && (
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null
                                  setOptionImageFiles({ ...optionImageFiles, [idx]: file })
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Click the radio button next to the correct answer
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">YouTube Video URL (Explanation)</label>
                <input
                  type="url"
                  value={questionForm.video_url}
                  onChange={(e) => setQuestionForm({ ...questionForm, video_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 mb-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Explanation
                </label>
                <textarea
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {isCreating ? 'Updating...' : 'Update Question'}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-6 py-2.5 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Import Questions from CSV</h3>
              <button onClick={closeImportModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleImportCSV} className="p-6 space-y-6">
              {error && showImportModal && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-blue-900">CSV Format</h4>
                  <a
                    href="/api/v1/admin/questions/csv-template"
                    download="questions_template.csv"
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Download Template
                  </a>
                </div>
                <p className="text-sm text-blue-800 mb-3">
                  Your CSV file should have the following columns:
                </p>
                <code className="block bg-white p-3 rounded text-xs font-mono text-gray-800 overflow-x-auto">
                  question_text,option_a,option_b,option_c,option_d,correct_answer,explanation
                </code>
                <ul className="mt-3 text-sm text-blue-800 space-y-1">
                  <li>• <strong>correct_answer</strong> should be A, B, C, or D</li>
                  <li>• <strong>explanation</strong> is optional</li>
                  <li>• Images cannot be imported via CSV — use the "Upload Images ZIP" button after importing</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File *
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Questions will be appended to existing questions. You can edit each question later to add images if needed.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isCreating || !csvFile}
                  className="px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {isCreating ? 'Importing...' : 'Import Questions'}
                </button>
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="px-6 py-2.5 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZIP Image Upload Modal */}
      {showZipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Upload Question Images (ZIP)</h3>
              <button onClick={() => { setShowZipModal(false); setZipResult(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Naming guide */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 space-y-2">
                <p className="font-bold uppercase tracking-wide text-xs text-amber-700">Filename naming convention</p>
                <ul className="space-y-1 text-xs font-mono">
                  <li><span className="font-bold">1-0.png</span> → Question 1 — question image</li>
                  <li><span className="font-bold">1-1.png</span> → Question 1 — Answer A image</li>
                  <li><span className="font-bold">1-2.png</span> → Question 1 — Answer B image</li>
                  <li><span className="font-bold">30-4.png</span> → Question 30 — Answer D image</li>
                </ul>
                <p className="text-[11px] text-amber-700 mt-2">Supported formats: PNG, JPG, JPEG, GIF, WEBP. Files with incorrect names are skipped.</p>
              </div>

              {/* Error banner */}
              {error && showZipModal && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              {/* Result summary */}
              {zipResult && (
                <div className={`rounded-lg p-4 border text-sm space-y-2 ${zipResult.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                  <p className="font-semibold">{zipResult.message}</p>
                  {zipResult.errors.length > 0 && (
                    <details className="text-xs text-red-700">
                      <summary className="cursor-pointer font-medium">Show {zipResult.errors.length} error(s)</summary>
                      <ul className="mt-2 space-y-0.5 list-disc list-inside">
                        {zipResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              {!zipResult && (
                <form onSubmit={handleZipUpload} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Select ZIP File *</label>
                    <input
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                    {zipFile && (
                      <p className="text-xs text-gray-500 mt-1">{zipFile.name} — {(zipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={zipUploading || !zipFile}
                      className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {zipUploading ? 'Uploading & applying…' : 'Upload ZIP'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowZipModal(false); setZipResult(null) }}
                      className="px-4 py-2.5 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {zipResult && (
                <div className="flex justify-end">
                  <button
                    onClick={() => { setShowZipModal(false); setZipResult(null) }}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paper Preview Modal - Exact Student View Mimic */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-gray-100 z-[100] overflow-y-auto">
          {/* Watermark Overlay (As in student section) */}
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

          {/* Admin Header (External to student layout) */}
          <div className="sticky top-0 bg-gray-900 px-6 py-2 flex items-center justify-between text-white z-50 shadow-lg">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Preview Mode:</span>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={showAnswers}
                  onChange={() => setShowAnswers(!showAnswers)}
                />
                <div className={`w-8 h-4 rounded-full shadow-inner transition-colors ${showAnswers ? 'bg-teal-500' : 'bg-gray-700'}`}></div>
                <div className={`absolute left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showAnswers ? 'translate-x-4' : ''}`}></div>
                <span className="text-xs font-semibold">Master Copy (Show Answers)</span>
              </label>
            </div>
            <button 
              onClick={() => setShowPreviewModal(false)}
              className="text-white hover:text-teal-400 font-bold text-sm bg-white/10 px-3 py-1 rounded-lg border border-white/20 transition-all"
            >
              CLOSE PREVIEW
            </button>
          </div>

          <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 select-none">
            {/* Student Header Bar */}
            <div className="bg-white border-b border-gray-200 shadow-sm -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 sm:py-3 mb-4 sm:mb-6">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-lg font-bold text-gray-900 truncate">{exam?.title}</h1>
                  <p className="text-xs text-gray-600">
                    {course?.subject} • {course?.grade ? `Grade ${course.grade}` : ''} •{' '}
                    <span className="text-teal-600 font-semibold italic">Preview Mode</span>
                  </p>
                </div>
                <div className="bg-teal-50 px-3 py-1 rounded-lg border border-teal-100">
                   <p className="text-[10px] text-teal-600 font-bold uppercase tracking-tighter text-center">Questions</p>
                   <p className="text-sm font-black text-teal-700 text-center">{questions.length}</p>
                </div>
              </div>
            </div>

            {/* Questions Section */}
            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={question.id} className={`bg-white border rounded-xl p-4 sm:p-6 shadow-sm transition-all ${showAnswers ? 'border-teal-100 ring-1 ring-teal-50' : 'border-gray-200'}`}>
                  <div className={question.question_image_url ? 'flex flex-col lg:flex-row gap-4 lg:gap-6' : ''}>
                    <div className={question.question_image_url ? 'flex-1 order-2 lg:order-1' : ''}>
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                        {index + 1}. {question.question_text}
                      </h2>
                      <div className="space-y-2">
                        {question.options.map((option, oIdx) => (
                          <div
                            key={oIdx}
                            className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg transition-colors ${
                              showAnswers && option.is_correct
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${question.id}-preview`}
                              checked={showAnswers && option.is_correct}
                              readOnly
                              className="mt-1 flex-shrink-0 accent-teal-600"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800">{optionLabel(oIdx + 1)}.</p>
                              {option.option_text && <p className="text-sm sm:text-base text-gray-700">{option.option_text}</p>}
                              {option.option_image_url && (
                                <img
                                  src={option.option_image_url}
                                  alt="Option"
                                  className="mt-2 max-h-20 sm:max-h-28 rounded border border-gray-100 object-contain"
                                />
                              )}
                            </div>
                            {showAnswers && option.is_correct && (
                              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>

                      {(showAnswers && (question.explanation || question.video_url)) && (
                        <div className="mt-4 bg-teal-50/50 border border-teal-100 rounded-lg p-3 text-sm">
                           {question.explanation && (
                             <>
                               <p className="font-bold text-teal-800 text-xs uppercase mb-1">Explanation:</p>
                               <p className="text-teal-900/80 leading-relaxed italic mb-3">{question.explanation}</p>
                             </>
                           )}
                           {question.video_url && (
                             <div className="mt-2 aspect-video w-full max-w-md">
                               <iframe
                                 width="100%"
                                 height="100%"
                                 src={getYouTubeEmbedUrl(question.video_url)}
                                 title="Video Explanation"
                                 frameBorder="0"
                                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                 allowFullScreen
                                 className="rounded-lg shadow-sm"
                               ></iframe>
                             </div>
                           )}
                        </div>
                      )}
                    </div>

                    {question.question_image_url && (
                      <div className="w-full lg:w-64 flex-shrink-0 order-1 lg:order-2">
                        <img
                          src={question.question_image_url}
                          alt={`Question ${index + 1}`}
                          className="w-full h-auto rounded-lg border border-gray-200 lg:sticky lg:top-20 object-contain max-h-64 sm:max-h-80 lg:max-h-[400px]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-20 pb-20 text-center">
               <div className="w-16 h-1 w-full bg-gray-200 rounded-full max-w-xs mx-auto mb-4" />
               <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">End of Preview</p>
            </div>
          </main>
        </div>
      )}
    </div>
  )
}

function getYouTubeEmbedUrl(url: string | null): string {
  if (!url) return ''
  let videoId = ''
  
  if (url.includes('youtube.com/watch?v=')) {
    videoId = url.split('v=')[1].split('&')[0]
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1].split('?')[0]
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('embed/')[1].split('?')[0]
  }
  
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url
}

