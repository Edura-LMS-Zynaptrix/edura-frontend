import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import {
  login as apiLogin,
  register as apiRegister,
  getCurrentUser,
  createProfile as apiCreateProfile,
  updateProfile as apiUpdateProfile,
  updateProfilePhoto as apiUpdateProfilePhoto,
  forgotPassword as apiForgotPassword,
  resetPassword as apiResetPassword,
  setPassword as apiSetPassword,
  changePassword as apiChangePassword,
} from '@/lib/api/auth'
import { googleLogin as apiGoogleLogin, completeGoogleProfile as apiCompleteGoogleProfile } from '@/lib/api/googleAuth'
import { getErrorMessage } from '@/lib/utils'

interface User {
  id: string
  email: string
  role: string
  is_active: boolean
  auth_provider?: string    // 'email' | 'google'
  has_password?: boolean    // true when password_hash is set
  full_name?: string
  needs_profile_completion?: boolean
  profile?: any
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isInitialized: boolean   // true after AuthInitializer has run (prevents reload redirect)
  isLoading: boolean
  error: string | null
  needsProfileCompletion: boolean
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  error: null,
  needsProfileCompletion: false,
}

// Helper to manage storage consistently
const syncTokensToStorage = (tokens: { access_token: string; refresh_token: string }, rememberMe: boolean = false) => {
  if (typeof window === 'undefined') return
  const storage = rememberMe ? localStorage : sessionStorage
  const other = rememberMe ? sessionStorage : localStorage
  
  storage.setItem('accessToken', tokens.access_token)
  storage.setItem('refreshToken', tokens.refresh_token)
  other.removeItem('accessToken')
  other.removeItem('refreshToken')
}

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string; remember_me?: boolean }, { rejectWithValue }) => {
    try {
      const response = await apiLogin(credentials)
      syncTokensToStorage(response, !!credentials.remember_me)
      return response
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const register = createAsyncThunk(
  'auth/register',
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await apiRegister(data)
      return response
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await getCurrentUser()
      return response
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (data: { current_password: string; new_password: string }, { rejectWithValue }) => {
    try {
      const response = await apiChangePassword(data)
      return response
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

// Must run once, right after the very first login following registration —
// auth_service's /register never creates a profile itself.
export const createProfile = createAsyncThunk(
  'auth/createProfile',
  async (data: { first_name: string; last_name: string; mobile_no?: string }, { rejectWithValue }) => {
    try {
      return await apiCreateProfile(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data: any, { rejectWithValue }) => {
    try {
      return await apiUpdateProfile(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const updateProfilePhoto = createAsyncThunk(
  'auth/updateProfilePhoto',
  async (data: FormData, { rejectWithValue }) => {
    try {
      return await apiUpdateProfilePhoto(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const googleLoginThunk = createAsyncThunk(
  'auth/googleLogin',
  async (idToken: string, { rejectWithValue }) => {
    try {
      const response = await apiGoogleLogin(idToken)
      // Google Login currently defaults to session storage
      syncTokensToStorage(response, false)
      return response
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const completeProfileThunk = createAsyncThunk(
  'auth/completeGoogleProfile',
  async (profileData: any, { rejectWithValue }) => {
    try {
      const response = await apiCompleteGoogleProfile(profileData)
      return response
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const forgotPasswordThunk = createAsyncThunk(
  'auth/forgotPassword',
  async (email: string, { rejectWithValue }) => {
    try {
      return await apiForgotPassword({ email })
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const resetPasswordThunk = createAsyncThunk(
  'auth/resetPassword',
  async (data: { token: string; new_password: string; confirm_password: string }, { rejectWithValue }) => {
    try {
      return await apiResetPassword(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const setPasswordThunk = createAsyncThunk(
  'auth/setPassword',
  async (data: { new_password: string; confirm_password: string }, { rejectWithValue }) => {
    try {
      return await apiSetPassword(data)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.needsProfileCompletion = false
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        sessionStorage.removeItem('accessToken')
        sessionStorage.removeItem('refreshToken')
      }
    },
    setCredentials: (state, action: PayloadAction<{ accessToken: string; refreshToken: string; persist?: boolean }>) => {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      if (typeof window !== 'undefined' && action.payload.persist) {
        localStorage.setItem('accessToken', action.payload.accessToken)
        localStorage.setItem('refreshToken', action.payload.refreshToken)
      }
    },
    clearNeedsProfileCompletion: (state) => {
      state.needsProfileCompletion = false
    },
    // Called immediately on startup when tokens exist in storage,
    // before the /auth/me network call completes — eliminates reload flash.
    setAuthenticatedFromStorage: (state) => {
      state.isAuthenticated = true
      state.isInitialized = true
    },
    // Called when AuthInitializer determines no tokens in storage (not logged in)
    setInitialized: (state) => {
      state.isInitialized = true
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false
        state.accessToken = action.payload.access_token
        state.refreshToken = action.payload.refresh_token
        state.isAuthenticated = true
        // Token storage is handled inside the thunk (localStorage vs sessionStorage)
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(register.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Fetch current user
      .addCase(fetchCurrentUser.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload
        state.isAuthenticated = true
        state.needsProfileCompletion = !!action.payload.needs_profile_completion
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.isLoading = false
        state.isAuthenticated = false
        state.isInitialized = true  // even if /auth/me fails, we're initialized
      })
      // Change password
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Google Login
      .addCase(googleLoginThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(googleLoginThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.accessToken = action.payload.access_token
        state.refreshToken = action.payload.refresh_token
        state.isAuthenticated = true
        state.needsProfileCompletion = action.payload.needs_profile_completion
      })
      .addCase(googleLoginThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Create profile
      .addCase(createProfile.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createProfile.fulfilled, (state, action) => {
        state.isLoading = false
        if (state.user) {
          state.user = { ...state.user, profile: action.payload, full_name: action.payload.name }
        }
      })
      .addCase(createProfile.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Update profile
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false
        if (state.user) {
          state.user = { ...state.user, profile: { ...state.user.profile, ...action.payload } }
        }
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Update profile photo
      .addCase(updateProfilePhoto.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateProfilePhoto.fulfilled, (state, action) => {
        state.isLoading = false
        if (state.user) {
          state.user = { ...state.user, profile: { ...state.user.profile, ...action.payload } }
        }
      })
      .addCase(updateProfilePhoto.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // completeProfileThunk cases
      .addCase(completeProfileThunk.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(completeProfileThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.needsProfileCompletion = false
        if (state.user) {
          state.user = { ...state.user, needs_profile_completion: false }
        }
      })
      .addCase(completeProfileThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Forgot password
      .addCase(forgotPasswordThunk.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(forgotPasswordThunk.fulfilled, (state) => { state.isLoading = false })
      .addCase(forgotPasswordThunk.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string })
      // Reset password
      .addCase(resetPasswordThunk.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(resetPasswordThunk.fulfilled, (state) => { state.isLoading = false })
      .addCase(resetPasswordThunk.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string })
      // Set password
      .addCase(setPasswordThunk.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(setPasswordThunk.fulfilled, (state) => { state.isLoading = false })
      .addCase(setPasswordThunk.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string })
  },
})

export const { logout, setCredentials, clearNeedsProfileCompletion, setAuthenticatedFromStorage, setInitialized } = authSlice.actions
export default authSlice.reducer
