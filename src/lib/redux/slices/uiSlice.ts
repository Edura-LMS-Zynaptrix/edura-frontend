import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface UIState {
  notifications: Notification[]
  isLoading: boolean
  loadingMessage: string | null
}

const initialState: UIState = {
  notifications: [],
  isLoading: false,
  loadingMessage: null,
}

// Date.now() alone collides when two notifications fire in the same
// millisecond (e.g. two showNotification dispatches back-to-back during
// login) — pairing it with a monotonic counter keeps ids unique.
let notificationSeq = 0

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    showNotification: (state, action: PayloadAction<Omit<Notification, 'id'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: `${Date.now()}-${++notificationSeq}`,
      }
      state.notifications.push(notification)
    },
    hideNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload)
    },
    clearNotifications: (state) => {
      state.notifications = []
    },
    setLoading: (state, action: PayloadAction<{ isLoading: boolean; message?: string }>) => {
      state.isLoading = action.payload.isLoading
      state.loadingMessage = action.payload.message || null
    },
  },
})

export const {
  showNotification,
  hideNotification,
  clearNotifications,
  setLoading,
} = uiSlice.actions

export default uiSlice.reducer
