import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import * as adminApi from '@/lib/api/admin'
import * as studentApi from '@/lib/api/student'
import type {
  AdminStats,
  AnalyticsData,
  AdminStudentsResponse,
  AdminStudent,
  AdminRankingsResponse,
  AdminStream,
  StreamCreateData,
  StreamUpdateData,
} from '@/lib/api/admin'
import { getErrorMessage } from '@/lib/utils'

// ── State ──────────────────────────────────────────────────────────────────

interface AdminState {
  // Dashboard stats
  stats: AdminStats | null
  statsLoading: boolean

  // Analytics
  analytics: AnalyticsData | null
  analyticsLoading: boolean

  // Students
  students: AdminStudent[]
  studentsTotal: number
  studentsLoading: boolean

  // Rankings
  rankings: AdminRankingsResponse | null
  rankingsLoading: boolean

  // Streams
  streams: AdminStream[]
  streamsLoading: boolean

  // Sub-admins (Super Admin only)
  subAdmins: adminApi.AdminResponse[]
  subAdminsLoading: boolean
  
  // Student Progress
  selectedStudentProgress: adminApi.StudentProgressData | null
  progressLoading: boolean

  // Attempt Review Audit
  selectedAttemptReview: any | null
  reviewLoading: boolean

  // Report Generation
  reportLoading: boolean

  // Course Struggle Analysis
  selectedCourseStruggle: adminApi.CourseStruggleResponse | null
  struggleLoading: boolean

  error: string | null
}

const initialState: AdminState = {
  stats: null,
  statsLoading: false,

  analytics: null,
  analyticsLoading: false,

  students: [],
  studentsTotal: 0,
  studentsLoading: false,

  rankings: null,
  rankingsLoading: false,

  // Streams
  streams: [],
  streamsLoading: false,

  // Sub-admins
  subAdmins: [],
  subAdminsLoading: false,

  selectedStudentProgress: null,
  progressLoading: false,

  selectedAttemptReview: null,
  reviewLoading: false,

  reportLoading: false,

  selectedCourseStruggle: null,
  struggleLoading: false,

  error: null,
}

// ── Thunks ─────────────────────────────────────────────────────────────────

export const fetchAdminStats = createAsyncThunk(
  'admin/fetchAdminStats',
  async (_, { rejectWithValue }) => {
    try {
      return await adminApi.getAdminStats()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchAdminAnalytics = createAsyncThunk(
  'admin/fetchAdminAnalytics',
  async (_, { rejectWithValue }) => {
    try {
      return await adminApi.getAdminAnalytics()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchAdminStudents = createAsyncThunk(
  'admin/fetchAdminStudents',
  async (
    params: { search?: string; grade?: number; district?: string; is_active?: boolean; skip?: number; limit?: number } | undefined,
    { rejectWithValue }
  ) => {
    try {
      return await adminApi.getAdminStudents(params)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const toggleStudentActiveStatus = createAsyncThunk(
  'admin/toggleStudentActiveStatus',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await adminApi.toggleStudentActive(userId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const deleteStudentAction = createAsyncThunk(
  'admin/deleteStudent',
  async (userId: string, { rejectWithValue }) => {
    try {
      await adminApi.deleteStudent(userId)
      return userId
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchAdminRankings = createAsyncThunk(
  'admin/fetchAdminRankings',
  async (
    params: { exam_id?: string; district?: string; limit?: number } | undefined,
    { rejectWithValue }
  ) => {
    try {
      return await adminApi.getAdminRankings(params)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchStreams = createAsyncThunk(
  'admin/fetchStreams',
  async (_, { rejectWithValue }) => {
    try {
      return await adminApi.getStreams()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchPublicStreams = createAsyncThunk(
  'admin/fetchPublicStreams',
  async (_, { rejectWithValue }) => {
    try {
      return await studentApi.getStreams()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const createStreamAction = createAsyncThunk(
  'admin/createStream',
  async (data: StreamCreateData, { rejectWithValue }) => {
    try {
      return await adminApi.createStream(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const updateStreamAction = createAsyncThunk(
  'admin/updateStream',
  async ({ id, data }: { id: string; data: StreamUpdateData }, { rejectWithValue }) => {
    try {
      return await adminApi.updateStream(id, data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const deleteStreamAction = createAsyncThunk(
  'admin/deleteStream',
  async (id: string, { rejectWithValue }) => {
    try {
      await adminApi.deleteStream(id)
      return id
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchSubAdmins = createAsyncThunk(
  'admin/fetchSubAdmins',
  async (_, { rejectWithValue }) => {
    try {
      const data = await adminApi.getSubAdmins()
      return data.admins
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const createSubAdminAction = createAsyncThunk(
  'admin/createSubAdmin',
  async (data: adminApi.AdminCreateData, { rejectWithValue }) => {
    try {
      return await adminApi.createSubAdmin(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const deleteSubAdminAction = createAsyncThunk(
  'admin/deleteSubAdmin',
  async (adminId: string, { rejectWithValue }) => {
    try {
      await adminApi.deleteSubAdmin(adminId)
      return adminId
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchStudentProgress = createAsyncThunk(
  'admin/fetchStudentProgress',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await adminApi.getStudentProgress(userId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchStudentAttemptReview = createAsyncThunk(
  'admin/fetchStudentAttemptReview',
  async ({ userId, attemptId }: { userId: string; attemptId: string }, { rejectWithValue }) => {
    try {
      return await adminApi.fetchStudentAttemptReview(userId, attemptId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const sendStudentReportAction = createAsyncThunk(
  'admin/sendStudentReport',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await adminApi.sendStudentReportDetail(userId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchCourseStruggleAnalysis = createAsyncThunk(
  'admin/fetchCourseStruggleAnalysis',
  async (courseId: string, { rejectWithValue }) => {
    try {
      return await adminApi.getCourseStruggleAnalysis(courseId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

// ── Slice ──────────────────────────────────────────────────────────────────

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearAdminError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Stats
      .addCase(fetchAdminStats.pending, (state) => {
        state.statsLoading = true
        state.error = null
      })
      .addCase(fetchAdminStats.fulfilled, (state, action: PayloadAction<AdminStats>) => {
        state.statsLoading = false
        state.stats = action.payload
      })
      .addCase(fetchAdminStats.rejected, (state, action) => {
        state.statsLoading = false
        state.error = action.payload as string
      })

      // Analytics
      .addCase(fetchAdminAnalytics.pending, (state) => {
        state.analyticsLoading = true
        state.error = null
      })
      .addCase(fetchAdminAnalytics.fulfilled, (state, action: PayloadAction<AnalyticsData>) => {
        state.analyticsLoading = false
        state.analytics = action.payload
      })
      .addCase(fetchAdminAnalytics.rejected, (state, action) => {
        state.analyticsLoading = false
        state.error = action.payload as string
      })

      // Students
      .addCase(fetchAdminStudents.pending, (state) => {
        state.studentsLoading = true
        state.error = null
      })
      .addCase(fetchAdminStudents.fulfilled, (state, action: PayloadAction<AdminStudentsResponse>) => {
        state.studentsLoading = false
        state.students = action.payload.students
        state.studentsTotal = action.payload.total
      })
      .addCase(fetchAdminStudents.rejected, (state, action) => {
        state.studentsLoading = false
        state.error = action.payload as string
      })

      // Toggle student active — update in-place in Redux state
      .addCase(toggleStudentActiveStatus.fulfilled, (state, action: PayloadAction<{ user_id: string; is_active: boolean }>) => {
        const student = state.students.find(s => s.user_id === action.payload.user_id)
        if (student) student.is_active = action.payload.is_active
      })
      .addCase(toggleStudentActiveStatus.rejected, (state, action) => {
        state.error = action.payload as string
      })

      // Delete student
      .addCase(deleteStudentAction.fulfilled, (state, action: PayloadAction<string>) => {
        state.students = state.students.filter(s => s.user_id !== action.payload)
        state.studentsTotal -= 1
      })
      .addCase(deleteStudentAction.rejected, (state, action) => {
        state.error = action.payload as string
      })

      // Rankings
      .addCase(fetchAdminRankings.pending, (state) => {
        state.rankingsLoading = true
        state.error = null
      })
      .addCase(fetchAdminRankings.fulfilled, (state, action: PayloadAction<AdminRankingsResponse>) => {
        state.rankingsLoading = false
        state.rankings = action.payload
      })
      .addCase(fetchAdminRankings.rejected, (state, action) => {
        state.rankingsLoading = false
        state.error = action.payload as string
      })

      // Streams
      .addCase(fetchStreams.pending, (state) => {
        state.streamsLoading = true
        state.error = null
      })
      .addCase(fetchStreams.fulfilled, (state, action: PayloadAction<AdminStream[]>) => {
        state.streamsLoading = false
        state.streams = action.payload
      })
      .addCase(fetchStreams.rejected, (state, action) => {
        state.streamsLoading = false
        state.error = action.payload as string
      })

      // Public Streams
      .addCase(fetchPublicStreams.pending, (state) => {
        state.streamsLoading = true
        state.error = null
      })
      .addCase(fetchPublicStreams.fulfilled, (state, action: PayloadAction<any[]>) => {
        state.streamsLoading = false
        state.streams = action.payload
      })
      .addCase(fetchPublicStreams.rejected, (state, action) => {
        state.streamsLoading = false
        state.error = action.payload as string
      })

      .addCase(createStreamAction.fulfilled, (state, action: PayloadAction<AdminStream>) => {
        state.streams.unshift(action.payload)
      })

      .addCase(updateStreamAction.fulfilled, (state, action: PayloadAction<AdminStream>) => {
        const index = state.streams.findIndex(s => s.id === action.payload.id)
        if (index !== -1) {
          state.streams[index] = action.payload
        }
      })

      .addCase(deleteStreamAction.fulfilled, (state, action: PayloadAction<string>) => {
        state.streams = state.streams.filter(s => s.id !== action.payload)
      })

      // Sub-Admins
      .addCase(fetchSubAdmins.pending, (state) => {
        state.subAdminsLoading = true
        state.error = null
      })
      .addCase(fetchSubAdmins.fulfilled, (state, action: PayloadAction<adminApi.AdminResponse[]>) => {
        state.subAdminsLoading = false
        state.subAdmins = action.payload
      })
      .addCase(fetchSubAdmins.rejected, (state, action) => {
        state.subAdminsLoading = false
        state.error = action.payload as string
      })

      .addCase(createSubAdminAction.fulfilled, (state, action: PayloadAction<adminApi.AdminResponse>) => {
        state.subAdmins.unshift(action.payload)
      })

      .addCase(deleteSubAdminAction.fulfilled, (state, action: PayloadAction<string>) => {
        state.subAdmins = state.subAdmins.filter(a => a.id !== action.payload)
      })

      // Student Progress
      .addCase(fetchStudentProgress.pending, (state) => {
        state.progressLoading = true
        state.error = null
      })
      .addCase(fetchStudentProgress.fulfilled, (state, action: PayloadAction<adminApi.StudentProgressData>) => {
        state.progressLoading = false
        state.selectedStudentProgress = action.payload
      })
      .addCase(fetchStudentProgress.rejected, (state, action) => {
        state.progressLoading = false
        state.error = action.payload as string
      })

      // Attempt Review Audit
      .addCase(fetchStudentAttemptReview.pending, (state) => {
        state.reviewLoading = true
        state.error = null
        state.selectedAttemptReview = null
      })
      .addCase(fetchStudentAttemptReview.fulfilled, (state, action) => {
        state.reviewLoading = false
        state.selectedAttemptReview = action.payload
      })
      .addCase(fetchStudentAttemptReview.rejected, (state, action) => {
        state.reviewLoading = false
        state.error = action.payload as string
      })

      .addCase(sendStudentReportAction.pending, (state) => {
        state.reportLoading = true
        state.error = null
      })
      .addCase(sendStudentReportAction.fulfilled, (state) => {
        state.reportLoading = false
      })
      .addCase(sendStudentReportAction.rejected, (state, action) => {
        state.reportLoading = false
        state.error = action.payload as string
      })

      // Course Struggle Analysis
      .addCase(fetchCourseStruggleAnalysis.pending, (state) => {
        state.struggleLoading = true
        state.error = null
        state.selectedCourseStruggle = null
      })
      .addCase(fetchCourseStruggleAnalysis.fulfilled, (state, action: PayloadAction<adminApi.CourseStruggleResponse>) => {
        state.struggleLoading = false
        state.selectedCourseStruggle = action.payload
      })
      .addCase(fetchCourseStruggleAnalysis.rejected, (state, action) => {
        state.struggleLoading = false
        state.error = action.payload as string
      })
  },
})

export const { clearAdminError } = adminSlice.actions
export default adminSlice.reducer
