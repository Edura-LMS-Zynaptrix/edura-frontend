import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import * as adminApi from '@/lib/api/admin'
import * as studentApi from '@/lib/api/student'
import { getErrorMessage } from '@/lib/utils'
import { setNewlyEarned } from './badgesSlice'
interface Exam {
  id: string
  course_id: string
  sub_course_id: string
  title: string
  image_url: string | null
  image_public_id?: string | null
  description?: string | null
  duration_minutes: number
  total_questions: number
  price: number
  order_number: number
  scheduled_start?: string | null
}

interface ExamsState {
  // Admin stats
  exams: Exam[]
  isLoading: boolean
  error: string | null

  // Student stats
  currentAttempt: studentApi.StartExamResponse | null
  lastAttempt: any | null
  examAccess: any | null
  studentLoading: boolean
  studentError: string | null

  // Admin Exam Access
  enrolledStudents: adminApi.EnrolledStudent[]
  eligibleStudents: adminApi.EligibleStudent[]
  accessLoading: boolean
  accessError: string | null
}

const initialState: ExamsState = {
  exams: [],
  isLoading: false,
  error: null,
  
  currentAttempt: null,
  lastAttempt: null,
  examAccess: null,
  studentLoading: false,
  studentError: null,

  enrolledStudents: [],
  eligibleStudents: [],
  accessLoading: false,
  accessError: null,
}

// Async thunks
export const fetchExams = createAsyncThunk(
  'exams/fetchExams',
  async (courseId: string | undefined, { rejectWithValue }) => {
    try {
      return await adminApi.getExams(courseId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const createExam = createAsyncThunk(
  'exams/createExam',
  async (data: any, { rejectWithValue }) => {
    try {
      return await adminApi.createExam(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const updateExam = createAsyncThunk(
  'exams/updateExam',
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    try {
      return await adminApi.updateExam(id, data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const deleteExam = createAsyncThunk(
  'exams/deleteExam',
  async (id: string, { rejectWithValue }) => {
    try {
      await adminApi.deleteExam(id)
      return id
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const startExam = createAsyncThunk(
  'exams/startExam',
  async (examId: string, { rejectWithValue }) => {
    try {
      const resp = await studentApi.startExam(examId)
      return resp
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      // 409 = already attempted — pass the full detail object as rejection payload
      if (error?.response?.status === 409 && detail?.already_attempted) {
        return rejectWithValue({ alreadyAttempted: true, ...detail })
      }
      // 403 with not_started_yet = exam schedule hasn't opened yet
      if (error?.response?.status === 403 && detail?.not_started_yet) {
        return rejectWithValue({ notStartedYet: true, message: detail.message, scheduledStart: detail.scheduled_start })
      }
      // 403 with is_locked = sequential progression lock
      if (error?.response?.status === 403 && detail?.is_locked) {
         return rejectWithValue({ isLocked: true, message: detail.lock_message, reason: detail.lock_reason })
      }

      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const submitExamAttempt = createAsyncThunk(
  'exams/submitExamAttempt',
  async ({ attemptId, payload }: { attemptId: string, payload: studentApi.SubmitExamRequest }, { rejectWithValue, dispatch }) => {
    try {
      const resp = await studentApi.submitExamAttempt(attemptId, payload)
      if (resp.new_badges && resp.new_badges.length > 0) {
        dispatch(setNewlyEarned(resp.new_badges))
      }
      return resp
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchLastAttempt = createAsyncThunk(
  'exams/fetchLastAttempt',
  async (examId: string, { rejectWithValue }) => {
    try {
      return await studentApi.getLastAttempt(examId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const checkExamAccess = createAsyncThunk(
  'exams/checkExamAccess',
  async (examId: string, { rejectWithValue }) => {
    try {
      return await studentApi.checkExamAccess(examId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

// Admin Access Management Thunks
export const fetchEnrolledStudents = createAsyncThunk(
  'exams/fetchEnrolledStudents',
  async (examId: string, { rejectWithValue }) => {
    try {
      return await adminApi.getEnrolledStudentsForExam(examId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchEligibleStudents = createAsyncThunk(
  'exams/fetchEligibleStudents',
  async ({ examId, search }: { examId: string; search?: string }, { rejectWithValue }) => {
    try {
      return await adminApi.getEligibleStudentsForExam(examId, search)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const grantExamAccessAction = createAsyncThunk(
  'exams/grantExamAccess',
  async ({ examId, userIds }: { examId: string; userIds: string[] }, { rejectWithValue }) => {
    try {
      await adminApi.grantExamAccess(examId, userIds)
      return { examId, userIds }
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const revokeExamAccessAction = createAsyncThunk(
  'exams/revokeExamAccess',
  async ({ examId, userId }: { examId: string; userId: string }, { rejectWithValue }) => {
    try {
      await adminApi.revokeExamAccess(examId, userId)
      return userId
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

// Course Access Management Thunks
export const fetchCourseEnrolledStudents = createAsyncThunk(
  'exams/fetchCourseEnrolledStudents',
  async (courseId: string, { rejectWithValue }) => {
    try {
      return await adminApi.getEnrolledStudentsForCourse(courseId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchCourseEligibleStudents = createAsyncThunk(
  'exams/fetchCourseEligibleStudents',
  async ({ courseId, search }: { courseId: string; search?: string }, { rejectWithValue }) => {
    try {
      return await adminApi.getEligibleStudentsForCourse(courseId, search)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const grantCourseAccessAction = createAsyncThunk(
  'exams/grantCourseAccess',
  async ({ courseId, userIds }: { courseId: string; userIds: string[] }, { rejectWithValue }) => {
    try {
      await adminApi.grantCourseAccess(courseId, userIds)
      return { courseId, userIds }
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const revokeCourseAccessAction = createAsyncThunk(
  'exams/revokeCourseAccess',
  async ({ courseId, userId }: { courseId: string; userId: string }, { rejectWithValue }) => {
    try {
      await adminApi.revokeCourseAccess(courseId, userId)
      return userId
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

// Sub-Course Access Management Thunks
export const fetchSubCourseEnrolledStudents = createAsyncThunk(
  'exams/fetchSubCourseEnrolledStudents',
  async (subCourseId: string, { rejectWithValue }) => {
    try {
      return await adminApi.getEnrolledStudentsForSubCourse(subCourseId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchSubCourseEligibleStudents = createAsyncThunk(
  'exams/fetchSubCourseEligibleStudents',
  async ({ subCourseId, search }: { subCourseId: string; search?: string }, { rejectWithValue }) => {
    try {
      return await adminApi.getEligibleStudentsForSubCourse(subCourseId, search)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const grantSubCourseAccessAction = createAsyncThunk(
  'exams/grantSubCourseAccess',
  async ({ subCourseId, userIds }: { subCourseId: string; userIds: string[] }, { rejectWithValue }) => {
    try {
      await adminApi.grantSubCourseAccess(subCourseId, userIds)
      return { subCourseId, userIds }
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const revokeSubCourseAccessAction = createAsyncThunk(
  'exams/revokeSubCourseAccess',
  async ({ subCourseId, userId }: { subCourseId: string; userId: string }, { rejectWithValue }) => {
    try {
      await adminApi.revokeSubCourseAccess(subCourseId, userId)
      return userId
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

// Video Module Access Management Thunks
export const fetchVideoModuleEnrolledStudents = createAsyncThunk(
  'exams/fetchVideoModuleEnrolledStudents',
  async (moduleId: string, { rejectWithValue }) => {
    try {
      return await adminApi.getEnrolledStudentsForVideoModule(moduleId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchVideoModuleEligibleStudents = createAsyncThunk(
  'exams/fetchVideoModuleEligibleStudents',
  async ({ moduleId, search }: { moduleId: string; search?: string }, { rejectWithValue }) => {
    try {
      return await adminApi.getEligibleStudentsForVideoModule(moduleId, search)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const grantVideoModuleAccessAction = createAsyncThunk(
  'exams/grantVideoModuleAccess',
  async ({ moduleId, userIds }: { moduleId: string; userIds: string[] }, { rejectWithValue }) => {
    try {
      await adminApi.grantVideoModuleAccess(moduleId, userIds)
      return { moduleId, userIds }
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const revokeVideoModuleAccessAction = createAsyncThunk(
  'exams/revokeVideoModuleAccess',
  async ({ moduleId, userId }: { moduleId: string; userId: string }, { rejectWithValue }) => {
    try {
      await adminApi.revokeVideoModuleAccess(moduleId, userId)
      return userId
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

const examsSlice = createSlice({
  name: 'exams',
  initialState,
  reducers: {
    clearExamsError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch exams
      .addCase(fetchExams.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchExams.fulfilled, (state, action: PayloadAction<Exam[]>) => {
        state.isLoading = false
        state.exams = action.payload
      })
      .addCase(fetchExams.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Create exam
      .addCase(createExam.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createExam.fulfilled, (state, action: PayloadAction<Exam>) => {
        state.isLoading = false
        state.exams.unshift(action.payload)
      })
      .addCase(createExam.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Update exam
      .addCase(updateExam.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateExam.fulfilled, (state, action: PayloadAction<Exam>) => {
        state.isLoading = false
        const index = state.exams.findIndex(e => e.id === action.payload.id)
        if (index !== -1) {
          state.exams[index] = action.payload
        }
      })
      .addCase(updateExam.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Delete exam
      .addCase(deleteExam.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(deleteExam.fulfilled, (state, action: PayloadAction<string>) => {
        state.isLoading = false
        state.exams = state.exams.filter(e => e.id !== action.payload)
      })
      .addCase(deleteExam.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Student Exams
      .addCase(startExam.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
        state.currentAttempt = null
      })
      .addCase(startExam.fulfilled, (state, action: PayloadAction<studentApi.StartExamResponse>) => {
        state.studentLoading = false
        state.currentAttempt = action.payload
      })
      .addCase(startExam.rejected, (state, action) => {
        state.studentLoading = false
        const p = action.payload as any
        if (typeof p === 'string') {
          state.studentError = p
        } else if (p && p.message && typeof p.message === 'string') {
          state.studentError = p.message
        } else {
          state.studentError = 'Failed to start exam'
        }
      })
      .addCase(submitExamAttempt.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
      })
      .addCase(submitExamAttempt.fulfilled, (state) => {
        state.studentLoading = false
        // Badge dispatching is handled inside the submitExamAttempt thunk itself
      })
      .addCase(submitExamAttempt.rejected, (state, action) => {
        state.studentLoading = false
        const p = action.payload as any
        state.studentError = typeof p === 'string' ? p : 'Auto-submit failed. Please try again.'
      })
      .addCase(fetchLastAttempt.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
        state.lastAttempt = null
      })
      .addCase(fetchLastAttempt.fulfilled, (state, action) => {
        state.studentLoading = false
        state.lastAttempt = action.payload
      })
      .addCase(fetchLastAttempt.rejected, (state, action) => {
        state.studentLoading = false
        const p = action.payload as any
        state.studentError = typeof p === 'string' ? p : 'Failed to load results.'
      })
      // Check Access
      .addCase(checkExamAccess.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
      })
      .addCase(checkExamAccess.fulfilled, (state, action) => {
        state.studentLoading = false
        state.examAccess = action.payload
      })
      .addCase(checkExamAccess.rejected, (state, action) => {
        state.studentLoading = false
        const p = action.payload as any
        state.studentError = typeof p === 'string' ? p : 'Access check failed.'
      })
      // Admin Access Management
      .addCase(fetchEnrolledStudents.pending, (state) => {
        state.accessLoading = true
        state.accessError = null
      })
      .addCase(fetchEnrolledStudents.fulfilled, (state, action) => {
        state.accessLoading = false
        state.enrolledStudents = action.payload
      })
      .addCase(fetchEnrolledStudents.rejected, (state, action) => {
        state.accessLoading = false
        state.accessError = action.payload as string
      })
      .addCase(fetchEligibleStudents.pending, (state) => {
        state.accessLoading = true
        state.accessError = null
      })
      .addCase(fetchEligibleStudents.fulfilled, (state, action) => {
        state.accessLoading = false
        state.eligibleStudents = action.payload
      })
      .addCase(fetchEligibleStudents.rejected, (state, action) => {
        state.accessLoading = false
        state.accessError = action.payload as string
      })
      .addCase(grantExamAccessAction.pending, (state) => {
        state.accessLoading = true
        state.accessError = null
      })
      .addCase(grantExamAccessAction.fulfilled, (state) => {
        state.accessLoading = false
      })
      .addCase(grantExamAccessAction.rejected, (state, action) => {
        state.accessLoading = false
        state.accessError = action.payload as string
      })
      .addCase(revokeExamAccessAction.pending, (state) => {
        state.accessLoading = true
        state.accessError = null
      })
      .addCase(revokeExamAccessAction.fulfilled, (state, action) => {
        state.accessLoading = false
        state.enrolledStudents = state.enrolledStudents.filter(s => s.user_id !== action.payload)
      })
      .addCase(revokeExamAccessAction.rejected, (state, action) => {
        state.accessLoading = false
        state.accessError = action.payload as string
      })
      // Course Access
      .addCase(fetchCourseEnrolledStudents.pending, (state) => {
        state.accessLoading = true
        state.accessError = null
      })
      .addCase(fetchCourseEnrolledStudents.fulfilled, (state, action) => {
        state.accessLoading = false
        state.enrolledStudents = action.payload
      })
      .addCase(fetchCourseEnrolledStudents.rejected, (state, action) => {
        state.accessLoading = false
        state.accessError = action.payload as string
      })
      .addCase(fetchCourseEligibleStudents.fulfilled, (state, action) => {
        state.accessLoading = false
        state.eligibleStudents = action.payload
      })
      .addCase(revokeCourseAccessAction.fulfilled, (state, action) => {
        state.accessLoading = false
        state.enrolledStudents = state.enrolledStudents.filter(s => s.user_id !== action.payload)
      })
      // SubCourse Access
      .addCase(fetchSubCourseEnrolledStudents.pending, (state) => {
        state.accessLoading = true
        state.accessError = null
      })
      .addCase(fetchSubCourseEnrolledStudents.fulfilled, (state, action) => {
        state.accessLoading = false
        state.enrolledStudents = action.payload
      })
      .addCase(fetchSubCourseEnrolledStudents.rejected, (state, action) => {
        state.accessLoading = false
        state.accessError = action.payload as string
      })
      .addCase(fetchSubCourseEligibleStudents.fulfilled, (state, action) => {
        state.accessLoading = false
        state.eligibleStudents = action.payload
      })
      .addCase(revokeSubCourseAccessAction.fulfilled, (state, action) => {
        state.accessLoading = false
        state.enrolledStudents = state.enrolledStudents.filter(s => s.user_id !== action.payload)
      })
      // Video Module Access
      .addCase(fetchVideoModuleEnrolledStudents.pending, (state) => {
        state.accessLoading = true
        state.accessError = null
      })
      .addCase(fetchVideoModuleEnrolledStudents.fulfilled, (state, action) => {
        state.accessLoading = false
        state.enrolledStudents = action.payload
      })
      .addCase(fetchVideoModuleEnrolledStudents.rejected, (state, action) => {
        state.accessLoading = false
        state.accessError = action.payload as string
      })
      .addCase(fetchVideoModuleEligibleStudents.fulfilled, (state, action) => {
        state.accessLoading = false
        state.eligibleStudents = action.payload
      })
      .addCase(revokeVideoModuleAccessAction.fulfilled, (state, action) => {
        state.accessLoading = false
        state.enrolledStudents = state.enrolledStudents.filter(s => s.user_id !== action.payload)
      })
  },
})

export const { clearExamsError } = examsSlice.actions
export default examsSlice.reducer
