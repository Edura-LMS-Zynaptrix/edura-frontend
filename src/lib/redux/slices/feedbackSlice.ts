/**
 * Feedback Redux Slice
 */
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import * as feedbackApi from '@/lib/api/feedback'
import { getErrorMessage } from '@/lib/utils'

interface FeedbackState {
  items: feedbackApi.Feedback[]
  activeFeedbackId: string | null
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  success: boolean
}

const initialState: FeedbackState = {
  items: [],
  activeFeedbackId: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  success: false
}

// Thunks
export const fetchAllFeedbackThunk = createAsyncThunk(
  'feedback/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await feedbackApi.getAllFeedback()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const submitFeedbackThunk = createAsyncThunk(
  'feedback/submit',
  async (feedback: feedbackApi.FeedbackCreate, { rejectWithValue }) => {
    try {
      return await feedbackApi.submitFeedback(feedback)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const markReadThunk = createAsyncThunk(
  'feedback/markRead',
  async (feedbackId: string, { rejectWithValue }) => {
    try {
      return await feedbackApi.markFeedbackAsRead(feedbackId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const deleteFeedbackThunk = createAsyncThunk(
  'feedback/delete',
  async (feedbackId: string, { rejectWithValue }) => {
    try {
      await feedbackApi.deleteFeedback(feedbackId)
      return feedbackId
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

const feedbackSlice = createSlice({
  name: 'feedback',
  initialState,
  reducers: {
    setActiveFeedback: (state, action: PayloadAction<string | null>) => {
      state.activeFeedbackId = action.payload
    },
    clearFeedbackStatus: (state) => {
      state.success = false
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchAllFeedbackThunk
      .addCase(fetchAllFeedbackThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchAllFeedbackThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.items = action.payload
      })
      .addCase(fetchAllFeedbackThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

      // submitFeedbackThunk
      .addCase(submitFeedbackThunk.pending, (state) => {
        state.isSubmitting = true
        state.error = null
        state.success = false
      })
      .addCase(submitFeedbackThunk.fulfilled, (state) => {
        state.isSubmitting = false
        state.success = true
      })
      .addCase(submitFeedbackThunk.rejected, (state, action) => {
        state.isSubmitting = false
        state.error = action.payload as string
      })

      // markReadThunk
      .addCase(markReadThunk.fulfilled, (state, action) => {
        const index = state.items.findIndex(i => i.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
      })

      // deleteFeedbackThunk
      .addCase(deleteFeedbackThunk.fulfilled, (state, action) => {
        state.items = state.items.filter(i => i.id !== action.payload)
        if (state.activeFeedbackId === action.payload) {
          state.activeFeedbackId = null
        }
      })
  }
})

export const { setActiveFeedback, clearFeedbackStatus } = feedbackSlice.actions
export default feedbackSlice.reducer
