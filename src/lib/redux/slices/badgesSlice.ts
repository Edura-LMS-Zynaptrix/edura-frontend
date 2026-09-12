import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import apiClient from '@/lib/api/client'

export interface Badge {
  id: string
  name: string
  description: string
  category: 'activity' | 'performance' | 'milestone'
  icon_name: string
  criteria_key: string
}

export interface UserBadge {
  id: string
  badge_id: string
  user_id: string
  awarded_at: string
  badge: Badge
}

interface BadgesState {
  availableBadges: Badge[]
  earnedBadges: UserBadge[]
  isLoading: boolean
  error: string | null
  newlyEarned: Badge[] // For showing celebration popups
}

const initialState: BadgesState = {
  availableBadges: [],
  earnedBadges: [],
  isLoading: false,
  error: null,
  newlyEarned: [],
}

export const fetchBadgeDashboard = createAsyncThunk('badges/fetchDashboard', async (_, { rejectWithValue }) => {
  try {
    const response = await apiClient.get('/api/v1/badges/dashboard')
    return response.data
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.detail || 'Failed to fetch badges')
  }
})

export const fetchMyBadges = createAsyncThunk('badges/fetchMy', async (_, { rejectWithValue }) => {
  try {
    const response = await apiClient.get('/api/v1/badges/my')
    return response.data
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.detail || 'Failed to fetch earned badges')
  }
})

const badgesSlice = createSlice({
  name: 'badges',
  initialState,
  reducers: {
    setNewlyEarned: (state, action: PayloadAction<Badge[]>) => {
      state.newlyEarned = action.payload
    },
    clearNewlyEarned: (state) => {
      state.newlyEarned = []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBadgeDashboard.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchBadgeDashboard.fulfilled, (state, action) => {
        state.isLoading = false
        state.availableBadges = action.payload.available_badges
        state.earnedBadges = action.payload.earned_badges
      })
      .addCase(fetchBadgeDashboard.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      .addCase(fetchMyBadges.fulfilled, (state, action) => {
        state.earnedBadges = action.payload
      })
  },
})

export const { setNewlyEarned, clearNewlyEarned } = badgesSlice.actions
export default badgesSlice.reducer
