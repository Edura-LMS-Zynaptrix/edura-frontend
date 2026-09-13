import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import * as adminApi from '@/lib/api/admin'
import * as studentApi from '@/lib/api/student'
import { getErrorMessage } from '@/lib/utils'

interface VideoClassesState {
    currentVideoClass: studentApi.Course | null
    isLoading: boolean
    error: string | null
    
    // Admin management states
    adminLoading: boolean
    adminError: string | null
}

const initialState: VideoClassesState = {
    currentVideoClass: null,
    isLoading: false,
    error: null,
    adminLoading: false,
    adminError: null
}

// Student Thunks
export const fetchVideoClassDetails = createAsyncThunk(
    'videoClasses/fetchDetails',
    async (courseId: string, { rejectWithValue }) => {
        try {
            return await studentApi.getVideoClassDetails(courseId)
        } catch (error: any) {
            return rejectWithValue(getErrorMessage(error))
        }
    }
)

export const updateProgress = createAsyncThunk(
    'videoClasses/updateProgress',
    async (data: { video_id: string; is_completed: boolean; watched_percentage: number }, { rejectWithValue }) => {
        try {
            return await studentApi.updateVideoProgress(data)
        } catch (error: any) {
            return rejectWithValue(getErrorMessage(error))
        }
    }
)

// Admin Thunks
export const createModuleAction = createAsyncThunk(
    'videoClasses/createModule',
    async (data: adminApi.ModuleCreateData, { rejectWithValue }) => {
        try {
            return await adminApi.createModule(data)
        } catch (error: any) {
            return rejectWithValue(getErrorMessage(error))
        }
    }
)

export const createVideoAction = createAsyncThunk(
    'videoClasses/createVideo',
    async (data: adminApi.VideoCreateData, { rejectWithValue }) => {
        try {
            return await adminApi.createVideo(data)
        } catch (error: any) {
            return rejectWithValue(getErrorMessage(error))
        }
    }
)

const videoClassesSlice = createSlice({
    name: 'videoClasses',
    initialState,
    reducers: {
        clearVideoErrors: (state) => {
            state.error = null
            state.adminError = null
        }
    },
    extraReducers: (builder) => {
        builder
            // fetchVideoClassDetails
            .addCase(fetchVideoClassDetails.pending, (state) => {
                state.isLoading = true
                state.error = null
            })
            .addCase(fetchVideoClassDetails.fulfilled, (state, action) => {
                state.isLoading = false
                state.currentVideoClass = action.payload
            })
            .addCase(fetchVideoClassDetails.rejected, (state, action) => {
                state.isLoading = false
                state.error = action.payload as string
            })
            
            // updateProgress
            .addCase(updateProgress.fulfilled, (state, action) => {
                if (state.currentVideoClass && state.currentVideoClass.modules) {
                    state.currentVideoClass.modules.forEach(mod => {
                        const video = mod.videos.find(v => v.id === action.payload.video_id)
                        if (video) {
                            video.is_completed = action.payload.is_completed
                            video.watched_percentage = action.payload.watched_percentage
                        }
                    })
                }
            })
            
            // createModuleAction
            .addCase(createModuleAction.pending, (state) => {
                state.adminLoading = true
                state.adminError = null
            })
            .addCase(createModuleAction.fulfilled, (state) => {
                state.adminLoading = false
            })
            .addCase(createModuleAction.rejected, (state, action) => {
                state.adminLoading = false
                state.adminError = action.payload as string
            })
    }
})

export const { clearVideoErrors } = videoClassesSlice.actions
export default videoClassesSlice.reducer
