import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import * as paymentApi from '@/lib/api/payment'
import { getErrorMessage } from '@/lib/utils'

interface PaymentState {
  myPayments: paymentApi.PaymentResponse[]
  currentPaymentConfig: paymentApi.PayHereConfig | null
  pendingSlips: paymentApi.BankSlipResponse[]
  allSlips: paymentApi.BankSlipResponse[]
  paymentStats: paymentApi.PaymentStats | null
  earningsAnalysis: paymentApi.EarningsAnalysisResponse | null
  bankAccounts: paymentApi.BankAccount[]
  
  isLoading: boolean
  error: string | null
}

const initialState: PaymentState = {
  myPayments: [],
  currentPaymentConfig: null,
  pendingSlips: [],
  allSlips: [],
  paymentStats: null,
  earningsAnalysis: null,
  bankAccounts: [],
  
  isLoading: false,
  error: null,
}

export const initiatePaymentThunk = createAsyncThunk(
  'payment/initiate',
  async (data: paymentApi.PaymentInitiateRequest, { rejectWithValue }) => {
    try {
      return await paymentApi.initiatePayment(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchPayHereConfigThunk = createAsyncThunk(
  'payment/fetchConfig',
  async (paymentId: string, { rejectWithValue }) => {
    try {
      return await paymentApi.getPayHereConfig(paymentId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const uploadBankSlipThunk = createAsyncThunk(
  'payment/uploadBankSlip',
  async (data: paymentApi.BankSlipUploadRequest, { rejectWithValue }) => {
    try {
      return await paymentApi.uploadBankSlip(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchAdminBankSlipsThunk = createAsyncThunk(
  'payment/fetchAdminSlips',
  async ({ statusFilter, courseId }: { statusFilter?: string, courseId?: string } = {}, { rejectWithValue }) => {
    try {
      return await paymentApi.getAllBankSlips(statusFilter, courseId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const verifyBankSlipThunk = createAsyncThunk(
  'payment/verifyBankSlip',
  async ({ slipId, verification }: { slipId: string, verification: paymentApi.BankSlipVerification }, { rejectWithValue }) => {
    try {
      return await paymentApi.verifyBankSlip(slipId, verification)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchBankAccountsThunk = createAsyncThunk(
  'payment/fetchBankAccounts',
  async (isAdmin: boolean, { rejectWithValue }) => {
    try {
      if (isAdmin) {
        return await paymentApi.getAdminBankAccounts()
      }
      return await paymentApi.getStudentBankAccounts()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const createBankAccountThunk = createAsyncThunk(
  'payment/createBankAccount',
  async (data: paymentApi.BankAccountCreate, { rejectWithValue }) => {
    try {
      return await paymentApi.createBankAccount(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const updateBankAccountThunk = createAsyncThunk(
  'payment/updateBankAccount',
  async ({ id, data }: { id: string, data: paymentApi.BankAccountUpdate }, { rejectWithValue }) => {
    try {
      return await paymentApi.updateBankAccount(id, data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const deleteBankAccountThunk = createAsyncThunk(
  'payment/deleteBankAccount',
  async (id: string, { rejectWithValue }) => {
    try {
      await paymentApi.deleteBankAccount(id)
      return id
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchEarningsAnalysisThunk = createAsyncThunk(
  'payment/fetchEarningsAnalysis',
  async (courseId: string | undefined, { rejectWithValue }) => {
    try {
      return await paymentApi.getEarningsAnalysis(courseId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    clearPaymentError: (state) => {
      state.error = null
    },
    clearCurrentConfig: (state) => {
      state.currentPaymentConfig = null
    }
  },
  extraReducers: (builder) => {
    builder
      // initiatePaymentThunk
      .addCase(initiatePaymentThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(initiatePaymentThunk.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(initiatePaymentThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // fetchPayHereConfigThunk
      .addCase(fetchPayHereConfigThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchPayHereConfigThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentPaymentConfig = action.payload
      })
      .addCase(fetchPayHereConfigThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // uploadBankSlipThunk
      .addCase(uploadBankSlipThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(uploadBankSlipThunk.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(uploadBankSlipThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // fetchAdminBankSlipsThunk
      .addCase(fetchAdminBankSlipsThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchAdminBankSlipsThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.allSlips = action.payload
      })
      .addCase(fetchAdminBankSlipsThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // verifyBankSlipThunk
      .addCase(verifyBankSlipThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(verifyBankSlipThunk.fulfilled, (state, action) => {
        state.isLoading = false
        // Update the slip in the local state
        const index = state.allSlips.findIndex(s => s.id === action.payload.id)
        if (index !== -1) {
          state.allSlips[index] = action.payload
        }
      })
      .addCase(verifyBankSlipThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Bank Accounts
      .addCase(fetchBankAccountsThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchBankAccountsThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.bankAccounts = action.payload
      })
      .addCase(fetchBankAccountsThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      .addCase(createBankAccountThunk.fulfilled, (state, action) => {
        state.bankAccounts.push(action.payload)
      })
      
      .addCase(updateBankAccountThunk.fulfilled, (state, action) => {
        const index = state.bankAccounts.findIndex(acc => acc.id === action.payload.id)
        if (index !== -1) {
          state.bankAccounts[index] = action.payload
        }
      })
      
      .addCase(deleteBankAccountThunk.fulfilled, (state, action) => {
        state.bankAccounts = state.bankAccounts.filter(acc => acc.id !== action.payload)
      })
      
      // fetchEarningsAnalysisThunk
      .addCase(fetchEarningsAnalysisThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchEarningsAnalysisThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.earningsAnalysis = action.payload
      })
      .addCase(fetchEarningsAnalysisThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  }
})

export const { clearPaymentError, clearCurrentConfig } = paymentSlice.actions
export default paymentSlice.reducer
