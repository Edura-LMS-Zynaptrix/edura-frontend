import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import * as studentApi from '@/lib/api/student'
import type { ReferralSummary, ReferralEventItem } from '@/lib/api/student'
import { getErrorMessage } from '@/lib/utils'

interface ReferralState {
  summary: ReferralSummary | null
  events: ReferralEventItem[]
  loadingSummary: boolean
  loadingEvents: boolean
  applyingCode: boolean
  error: string | null
}

const initialState: ReferralState = {
  summary: null,
  events: [],
  loadingSummary: false,
  loadingEvents: false,
  applyingCode: false,
  error: null,
}

export const fetchReferralSummary = createAsyncThunk(
  'referral/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      return await studentApi.getReferralSummary()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchReferralEvents = createAsyncThunk(
  'referral/fetchEvents',
  async (limit: number = 50, { rejectWithValue }) => {
    try {
      const response = await studentApi.getReferralEvents(limit)
      return response.events
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const applyReferralCodeThunk = createAsyncThunk(
  'referral/applyCode',
  async (referralCode: string, { dispatch, rejectWithValue }) => {
    try {
      const result = await studentApi.applyReferralCode(referralCode)
      await dispatch(fetchReferralSummary())
      await dispatch(fetchReferralEvents(50))
      return result
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

const referralSlice = createSlice({
  name: 'referral',
  initialState,
  reducers: {
    clearReferralError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReferralSummary.pending, (state) => {
        state.loadingSummary = true
        state.error = null
      })
      .addCase(fetchReferralSummary.fulfilled, (state, action: PayloadAction<ReferralSummary>) => {
        state.loadingSummary = false
        state.summary = action.payload
      })
      .addCase(fetchReferralSummary.rejected, (state, action) => {
        state.loadingSummary = false
        state.error = action.payload as string
      })

      .addCase(fetchReferralEvents.pending, (state) => {
        state.loadingEvents = true
        state.error = null
      })
      .addCase(fetchReferralEvents.fulfilled, (state, action: PayloadAction<ReferralEventItem[]>) => {
        state.loadingEvents = false
        state.events = action.payload
      })
      .addCase(fetchReferralEvents.rejected, (state, action) => {
        state.loadingEvents = false
        state.error = action.payload as string
      })

      .addCase(applyReferralCodeThunk.pending, (state) => {
        state.applyingCode = true
        state.error = null
      })
      .addCase(applyReferralCodeThunk.fulfilled, (state) => {
        state.applyingCode = false
      })
      .addCase(applyReferralCodeThunk.rejected, (state, action) => {
        state.applyingCode = false
        state.error = action.payload as string
      })
  },
})

export const { clearReferralError } = referralSlice.actions
export default referralSlice.reducer
