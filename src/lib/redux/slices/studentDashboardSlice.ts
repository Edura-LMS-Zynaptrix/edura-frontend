import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import * as studentApi from '@/lib/api/student'
import * as adminApi from '@/lib/api/admin'
import { MyEnrollmentsResponse, MyAttemptItem, ExamRankResponse, LeaderboardEntry, PlatformStats, RankingExam } from '@/lib/api/student'
import { getErrorMessage } from '@/lib/utils'

interface DashboardState {
  enrollments: MyEnrollmentsResponse
  attempts: MyAttemptItem[]
  platformStats: PlatformStats | null
  rankingExams: RankingExam[]
  leaderboard: LeaderboardEntry[]
  examRank: ExamRankResponse | null
  // Progress Analytics
  progress: adminApi.StudentProgressData | null
  loadingProgress: boolean

  // Attempt Review
  selectedAttemptReview: any | null
  loadingReview: boolean
  
  // Loading states
  loadingEnrollments: boolean
  loadingAttempts: boolean
  loadingStats: boolean
  loadingRankings: boolean
  
  // Error states
  error: string | null
}

const initialState: DashboardState = {
  enrollments: { courses: [], sub_courses: [], exams: [], modules: [] },
  attempts: [],
  platformStats: null,
  rankingExams: [],
  leaderboard: [],
  examRank: null,

  progress: null,
  loadingProgress: false,

  selectedAttemptReview: null,
  loadingReview: false,

  loadingEnrollments: false,
  loadingAttempts: false,
  loadingStats: false,
  loadingRankings: false,
  error: null,
}

export const fetchMyEnrollments = createAsyncThunk(
  'dashboard/fetchMyEnrollments',
  async (params: { offset?: number; limit?: number } | undefined, { rejectWithValue }) => {
    try {
      return await studentApi.getMyEnrollments(params?.offset ?? 0, params?.limit ?? 50)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchMyAttempts = createAsyncThunk(
  'dashboard/fetchMyAttempts',
  async (limit: number = 10, { rejectWithValue }) => {
    try {
      return await studentApi.getMyAttempts(limit)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchPlatformStats = createAsyncThunk(
  'dashboard/fetchPlatformStats',
  async (_, { rejectWithValue }) => {
    try {
      return await studentApi.getPlatformStats()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as { studentDashboard: DashboardState }
      if (state.studentDashboard.loadingStats) return false
      if (state.studentDashboard.platformStats) return false
      return true
    },
  }
)

export const fetchLeaderboard = createAsyncThunk(
  'dashboard/fetchLeaderboard',
  async (params: { exam_id: string; district?: string; limit?: number; offset?: number }, { rejectWithValue }) => {
    try {
      return await studentApi.getRankingsLeaderboard(params.exam_id, params.district, params.limit, params.offset)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchRankingExams = createAsyncThunk(
  'dashboard/fetchRankingExams',
  async (_, { rejectWithValue }) => {
    try {
      return await studentApi.getRankingExams()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as { studentDashboard: DashboardState }
      if (state.studentDashboard.loadingRankings) return false
      if (state.studentDashboard.rankingExams.length > 0) return false
      return true
    },
  }
)

export const fetchExamRank = createAsyncThunk(
  'dashboard/fetchExamRank',
  async (examId: string, { rejectWithValue }) => {
    try {
      return await studentApi.getExamRanking(examId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchMyProgress = createAsyncThunk(
  'dashboard/fetchMyProgress',
  async (_, { rejectWithValue }) => {
    try {
      return await studentApi.getMyProgress()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchAttemptReview = createAsyncThunk(
  'dashboard/fetchAttemptReview',
  async (attemptId: string, { rejectWithValue }) => {
    try {
      return await studentApi.fetchAttemptReview(attemptId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    clearDashboardError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      // Enrollments
      .addCase(fetchMyEnrollments.pending, (state) => {
        state.loadingEnrollments = true
        state.error = null
      })
      .addCase(fetchMyEnrollments.fulfilled, (state, action: PayloadAction<MyEnrollmentsResponse>) => {
        state.loadingEnrollments = false
        state.enrollments = action.payload
      })
      .addCase(fetchMyEnrollments.rejected, (state, action) => {
        state.loadingEnrollments = false
        state.error = action.payload as string
      })
      // Attempts
      .addCase(fetchMyAttempts.pending, (state) => {
        state.loadingAttempts = true
        state.error = null
      })
      .addCase(fetchMyAttempts.fulfilled, (state, action: PayloadAction<MyAttemptItem[]>) => {
        state.loadingAttempts = false
        state.attempts = action.payload
      })
      .addCase(fetchMyAttempts.rejected, (state, action) => {
        state.loadingAttempts = false
        state.error = action.payload as string
      })
      // Platform Stats
      .addCase(fetchPlatformStats.pending, (state) => {
        state.loadingStats = true
        state.error = null
      })
      .addCase(fetchPlatformStats.fulfilled, (state, action: PayloadAction<PlatformStats>) => {
        state.loadingStats = false
        state.platformStats = action.payload
      })
      .addCase(fetchPlatformStats.rejected, (state, action) => {
        state.loadingStats = false
        state.error = action.payload as string
      })
      // Leaderboard
      .addCase(fetchLeaderboard.pending, (state) => {
        state.loadingRankings = true
        state.error = null
      })
      .addCase(fetchLeaderboard.fulfilled, (state, action: PayloadAction<LeaderboardEntry[]>) => {
        state.loadingRankings = false
        state.leaderboard = action.payload
      })
      .addCase(fetchLeaderboard.rejected, (state, action) => {
        state.loadingRankings = false
        state.error = action.payload as string
      })
      // Ranking Exams
      .addCase(fetchRankingExams.pending, (state) => {
        state.loadingRankings = true
        state.error = null
      })
      .addCase(fetchRankingExams.fulfilled, (state, action: PayloadAction<RankingExam[]>) => {
        state.loadingRankings = false
        state.rankingExams = action.payload
      })
      .addCase(fetchRankingExams.rejected, (state, action) => {
        state.loadingRankings = false
        state.error = action.payload as string
      })
      // Exam Rank
      .addCase(fetchExamRank.pending, (state) => {
        state.loadingRankings = true
      })
      .addCase(fetchExamRank.fulfilled, (state, action: PayloadAction<ExamRankResponse>) => {
        state.loadingRankings = false
        state.examRank = action.payload
      })
      .addCase(fetchExamRank.rejected, (state, action) => {
        state.loadingRankings = false
        state.error = action.payload as string
      })
      // Progress Analytics
      .addCase(fetchMyProgress.pending, (state) => {
        state.loadingProgress = true
        state.error = null
      })
      .addCase(fetchMyProgress.fulfilled, (state, action: PayloadAction<adminApi.StudentProgressData>) => {
        state.loadingProgress = false
        state.progress = action.payload
      })
      .addCase(fetchMyProgress.rejected, (state, action) => {
        state.loadingProgress = false
        state.error = action.payload as string
      })
      // Attempt Review
      .addCase(fetchAttemptReview.pending, (state) => {
        state.loadingReview = true
        state.error = null
        state.selectedAttemptReview = null
      })
      .addCase(fetchAttemptReview.fulfilled, (state, action) => {
        state.loadingReview = false
        state.selectedAttemptReview = action.payload
      })
      .addCase(fetchAttemptReview.rejected, (state, action) => {
        state.loadingReview = false
        state.error = action.payload as string
      })
      // Clear all state on logout or new login to force re-fetch
      .addMatcher(
        (action) => action.type === 'auth/logout' || action.type === 'auth/login/fulfilled' || action.type === 'auth/googleLogin/fulfilled',
        (state) => {
          Object.assign(state, initialState)
        }
      )
  }
})

export const { clearDashboardError } = dashboardSlice.actions
export default dashboardSlice.reducer
