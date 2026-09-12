import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import * as adminApi from '@/lib/api/admin'
import * as studentApi from '@/lib/api/student'
import { ExamWithAccess } from '@/lib/api/student'

export interface AdminSubCourse {
  id: string
  course_id: string
  title: string
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
  is_active: boolean
  order_number: number
}

export interface AdminCourse {
  id: string
  title: string
  subject: string
  grade: number
  course_type: 'exam' | 'video'
  image_url: string | null
  image_public_id?: string | null
  price: number
  description?: string | null
  is_active?: boolean
  stream_ids: string[]
  sub_courses?: AdminSubCourse[]
}

export interface SubCourseCreateData {
  course_id: string
  title: string
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
  order_number: number
  is_active?: boolean
}

export interface SubCourseUpdateData {
  title?: string
  description?: string | null
  image_url?: string | null
  image_public_id?: string | null
  order_number?: number
  is_active?: boolean
}

interface CoursesState {
  // Admin states
  courses: AdminCourse[]
  isLoading: boolean
  error: string | null

  // Student states
  availableCourses: studentApi.Course[]
  currentCourse: studentApi.Course | null
  currentCourseExams: ExamWithAccess[]
  studentLoading: boolean
  studentError: string | null
}

const initialState: CoursesState = {
  courses: [],
  isLoading: false,
  error: null,
  
  availableCourses: [],
  currentCourse: null,
  currentCourseExams: [],
  studentLoading: false,
  studentError: null,
}

// Async thunks
export const fetchCourses = createAsyncThunk(
  'courses/fetchCourses',
  async (_, { rejectWithValue }) => {
    try {
      return await adminApi.getCourses()
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to load courses')
    }
  }
)

export const createCourse = createAsyncThunk(
  'courses/createCourse',
  async (data: {
    title: string
    subject: string
    grade: number
    course_type: 'exam' | 'video'
    price: number
    description?: string | null
    image_url?: string | null
    image_public_id?: string | null
    stream_ids?: string[]
  }, { rejectWithValue }) => {
    try {
      return await adminApi.createCourse(data)
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to create course')
    }
  }
)

export const updateCourse = createAsyncThunk(
  'courses/updateCourse',
  async ({ id, data }: { 
    id: string
    data: {
      title?: string
      subject?: string
      grade?: number
      course_type?: 'exam' | 'video'
      price?: number
      description?: string | null
      image_url?: string | null
      image_public_id?: string | null
      stream_ids?: string[]
    }
  }, { rejectWithValue }) => {
    try {
      return await adminApi.updateCourse(id, data)
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to update course')
    }
  }
)

export const createSubCourse = createAsyncThunk(
  'courses/createSubCourse',
  async (data: SubCourseCreateData, { rejectWithValue }) => {
    try {
      return await adminApi.createSubCourse(data)
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to create sub-course')
    }
  }
)

export const updateSubCourse = createAsyncThunk(
  'courses/updateSubCourse',
  async ({ id, data }: { id: string; data: SubCourseUpdateData }, { rejectWithValue }) => {
    try {
      return await adminApi.updateSubCourse(id, data)
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to update sub-course')
    }
  }
)

export const deleteSubCourse = createAsyncThunk(
  'courses/deleteSubCourse',
  async (id: string, { rejectWithValue }) => {
    try {
      await adminApi.deleteSubCourse(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to delete sub-course')
    }
  }
)

// === Student Thunks ===

export const fetchAvailableCourses = createAsyncThunk(
  'courses/fetchAvailableCourses',
  async (_, { rejectWithValue }) => {
    try {
      return await studentApi.getAvailableCourses()
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to load available courses')
    }
  }
)

export const fetchCourseOverview = createAsyncThunk(
  'courses/fetchCourseOverview',
  async (courseId: string, { rejectWithValue }) => {
    try {
      const data = await studentApi.getCourseOverview(courseId)
      return data
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to load course details')
    }
  }
)

export const fetchCourseExams = createAsyncThunk(
  'courses/fetchCourseExams',
  async (courseId: string, { rejectWithValue }) => {
    try {
      return await studentApi.getCourseExams(courseId)
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to load course exams')
    }
  }
)

export const fetchSubCourseExams = createAsyncThunk(
  'courses/fetchSubCourseExams',
  async (subCourseId: string, { rejectWithValue }) => {
    try {
      return await studentApi.getSubCourseExams(subCourseId)
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to load sub-course exams')
    }
  }
)

export const enrollFreeSubCourseThunk = createAsyncThunk(
  'courses/enrollFreeSubCourse',
  async (subCourseId: string, { rejectWithValue }) => {
    try {
      const response = await studentApi.enrollFreeSubCourse(subCourseId)
      return { subCourseId, ...response }
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to enroll in free sub-course')
    }
  }
)

export const enrollFreeCourseThunk = createAsyncThunk(
  'courses/enrollFreeCourse',
  async (courseId: string, { rejectWithValue }) => {
    try {
      const response = await studentApi.enrollFreeCourse(courseId)
      return { courseId, ...response }
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to enroll in free course')
    }
  }
)

export const enrollFreeVideoCourseThunk = createAsyncThunk(
  'courses/enrollFreeVideoCourse',
  async (courseId: string, { rejectWithValue }) => {
    try {
      const response = await studentApi.enrollFreeVideoCourse(courseId)
      return { courseId, ...response }
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to enroll in free video course')
    }
  }
)

export const enrollFreeModuleThunk = createAsyncThunk(
  'courses/enrollFreeModule',
  async (moduleId: string, { rejectWithValue }) => {
    try {
      const response = await studentApi.enrollFreeVideoModule(moduleId)
      return { moduleId, ...response }
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to enroll in free video module')
    }
  }
)

export const deleteCourse = createAsyncThunk(
  'courses/deleteCourse',
  async (id: string, { rejectWithValue }) => {
    try {
      await adminApi.deleteCourse(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to delete course')
    }
  }
)

export const uploadImageThunk = createAsyncThunk(
  'courses/uploadImage',
  async ({ file, entity }: { file: File; entity: string }, { rejectWithValue }) => {
    try {
      return await adminApi.uploadImage(file, entity)
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to upload image')
    }
  }
)

export const deleteImageThunk = createAsyncThunk(
  'courses/deleteImage',
  async (publicId: string, { rejectWithValue }) => {
    try {
      return await adminApi.deleteImage(publicId)
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.detail || 'Failed to delete image')
    }
  }
)

const coursesSlice = createSlice({
  name: 'courses',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    markExamAttempted: (state, action: PayloadAction<{ examId: string; score: number; total: number }>) => {
      const exam = state.currentCourseExams.find(e => e.id === action.payload.examId)
      if (exam) {
        exam.already_attempted = true
        exam.last_score = action.payload.score
        exam.last_total = action.payload.total
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch courses
      .addCase(fetchCourses.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchCourses.fulfilled, (state, action: PayloadAction<AdminCourse[]>) => {
        state.isLoading = false
        state.courses = action.payload
      })
      .addCase(fetchCourses.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Create course
      .addCase(createCourse.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createCourse.fulfilled, (state, action: PayloadAction<AdminCourse>) => {
        state.isLoading = false
        state.courses.unshift(action.payload)
      })
      .addCase(createCourse.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Update course
      .addCase(updateCourse.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateCourse.fulfilled, (state, action: PayloadAction<AdminCourse>) => {
        state.isLoading = false
        const index = state.courses.findIndex(c => c.id === action.payload.id)
        if (index !== -1) {
          state.courses[index] = action.payload
        }
      })
      .addCase(updateCourse.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Delete course
      .addCase(deleteCourse.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(deleteCourse.fulfilled, (state, action: PayloadAction<string>) => {
        state.isLoading = false
        state.courses = state.courses.filter(c => c.id !== action.payload)
      })
      .addCase(deleteCourse.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Create SubCourse
      .addCase(createSubCourse.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createSubCourse.fulfilled, (state, action: PayloadAction<AdminSubCourse>) => {
        state.isLoading = false
        const course = state.courses.find(c => c.id === action.payload.course_id)
        if (course) {
          if (!course.sub_courses) course.sub_courses = []
          course.sub_courses.push(action.payload)
        }
      })
      .addCase(createSubCourse.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Update SubCourse
      .addCase(updateSubCourse.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateSubCourse.fulfilled, (state, action: PayloadAction<AdminSubCourse>) => {
        state.isLoading = false
        const course = state.courses.find(c => c.id === action.payload.course_id)
        if (course && course.sub_courses) {
          const idx = course.sub_courses.findIndex(sc => sc.id === action.payload.id)
          if (idx !== -1) {
            course.sub_courses[idx] = action.payload
          }
        }
      })
      .addCase(updateSubCourse.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Delete SubCourse
      .addCase(deleteSubCourse.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(deleteSubCourse.fulfilled, (state, action: PayloadAction<string>) => {
        state.isLoading = false
        // We'll need to remove it from the corresponding course's sub_courses array.
        // We iterate through courses since we don't have course_id in the payload easily available from delete response (unless returned).
        state.courses.forEach(course => {
          if (course.sub_courses) {
            course.sub_courses = course.sub_courses.filter(sc => sc.id !== action.payload)
          }
        })
      })
      .addCase(deleteSubCourse.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // === Student Thunk Reducers ===

      // Fetch available courses
      .addCase(fetchAvailableCourses.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
      })
      .addCase(fetchAvailableCourses.fulfilled, (state, action: PayloadAction<studentApi.Course[]>) => {
        state.studentLoading = false
        state.availableCourses = action.payload
      })
      .addCase(fetchAvailableCourses.rejected, (state, action) => {
        state.studentLoading = false
        const p = action.payload as any
        state.studentError = typeof p === 'string' ? p : 'Failed to load courses.'
      })

      // Fetch course overview
      .addCase(fetchCourseOverview.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
        state.currentCourse = null
        state.currentCourseExams = []
      })
      .addCase(fetchCourseOverview.fulfilled, (state, action: PayloadAction<studentApi.Course>) => {
        state.studentLoading = false
        state.currentCourse = action.payload
      })
      .addCase(fetchCourseOverview.rejected, (state, action) => {
        state.studentLoading = false
        const p = action.payload as any
        state.studentError = typeof p === 'string' ? p : 'Failed to load course details.'
      })
      
      // Fetch course exams
      .addCase(fetchCourseExams.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
      })
      .addCase(fetchCourseExams.fulfilled, (state, action: PayloadAction<ExamWithAccess[]>) => {
        state.studentLoading = false
        state.currentCourseExams = action.payload
      })
      .addCase(fetchCourseExams.rejected, (state, action) => {
        state.studentLoading = false
        const p = action.payload as any
        state.studentError = typeof p === 'string' ? p : 'Failed to load exams.'
      })

      
      // fetchSubCourseExams
      .addCase(fetchSubCourseExams.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
      })
      .addCase(fetchSubCourseExams.fulfilled, (state, action: PayloadAction<ExamWithAccess[]>) => {
        state.studentLoading = false
        state.currentCourseExams = action.payload
      })
      .addCase(fetchSubCourseExams.rejected, (state, action) => {
        state.studentLoading = false
        const p = action.payload as any
        state.studentError = typeof p === 'string' ? p : 'Failed to load module exams.'
      })

      // enrollFreeSubCourseThunk
      .addCase(enrollFreeSubCourseThunk.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
      })
      .addCase(enrollFreeSubCourseThunk.fulfilled, (state, action) => {
        state.studentLoading = false
        if (state.currentCourse && state.currentCourse.sub_courses) {
          const idx = state.currentCourse.sub_courses.findIndex(sc => sc.id === action.payload.subCourseId)
          if (idx !== -1) {
            state.currentCourse.sub_courses[idx].is_enrolled = true
          }
        }
      })
      .addCase(enrollFreeSubCourseThunk.rejected, (state, action) => {
        state.studentLoading = false
        const p = action.payload as any
        state.studentError = typeof p === 'string' ? p : 'Failed to enroll in the module.'
      })

      // enrollFreeCourseThunk
      .addCase(enrollFreeCourseThunk.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
      })
      .addCase(enrollFreeCourseThunk.fulfilled, (state) => {
        state.studentLoading = false
        state.studentError = null
        if (state.currentCourse) {
          state.currentCourse.is_enrolled = true
        }
      })
      .addCase(enrollFreeCourseThunk.rejected, (state, action) => {
        state.studentLoading = false
        const p = action.payload as any
        state.studentError = typeof p === 'string' ? p : 'Failed to enroll in the course.'
      })

      // enrollFreeVideoCourseThunk
      .addCase(enrollFreeVideoCourseThunk.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
      })
      .addCase(enrollFreeVideoCourseThunk.fulfilled, (state) => {
        state.studentLoading = false
        if (state.currentCourse) state.currentCourse.is_enrolled = true
      })
      .addCase(enrollFreeVideoCourseThunk.rejected, (state, action) => {
        state.studentLoading = false
        state.studentError = action.payload as string
      })

      // enrollFreeModuleThunk
      .addCase(enrollFreeModuleThunk.pending, (state) => {
        state.studentLoading = true
        state.studentError = null
      })
      .addCase(enrollFreeModuleThunk.fulfilled, (state, action) => {
        state.studentLoading = false
        if (state.currentCourse && state.currentCourse.modules) {
          const idx = state.currentCourse.modules.findIndex(m => m.id === action.payload.moduleId)
          if (idx !== -1) {
            state.currentCourse.modules[idx].is_enrolled = true
          }
        }
      })
      .addCase(enrollFreeModuleThunk.rejected, (state, action) => {
        state.studentLoading = false
        state.studentError = action.payload as string
      })
  },
})

export const { clearError, markExamAttempted } = coursesSlice.actions
export default coursesSlice.reducer
