import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import uiReducer from './slices/uiSlice'
import coursesReducer from './slices/coursesSlice'
import examsReducer from './slices/examsSlice'
import questionsReducer from './slices/questionsSlice'
import studentDashboardReducer from './slices/studentDashboardSlice'
import adminReducer from './slices/adminSlice'
import paymentReducer from './slices/paymentSlice'
import referralReducer from './slices/referralSlice'
import badgesReducer from './slices/badgesSlice'
import videoClassesReducer from './slices/videoClassesSlice'
import chatReducer from './slices/chatSlice'
import feedbackReducer from './slices/feedbackSlice'
import { errorHandlingMiddleware } from './middleware'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    courses: coursesReducer,
    exams: examsReducer,
    questions: questionsReducer,
    studentDashboard: studentDashboardReducer,
    admin: adminReducer,
    payment: paymentReducer,
    referral: referralReducer,
    badges: badgesReducer,
    videoClasses: videoClassesReducer,
    chat: chatReducer,
    feedback: feedbackReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['ui/showNotification'],
      },
    }).concat(errorHandlingMiddleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
