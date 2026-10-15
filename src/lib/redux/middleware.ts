import { Middleware } from '@reduxjs/toolkit'
import { showNotification } from './slices/uiSlice'

/**
 * Redux middleware to handle errors globally and show notifications
 */
export const errorHandlingMiddleware: Middleware = (store) => (next) => (action: any) => {
  const result = next(action)
  
  // Check if action is rejected (error)
  if (action.type && action.type.endsWith('/rejected')) {
    const payload = action.payload

    // Skip toast for 409 "already attempted" — handled silently by the exam page
    if (payload && typeof payload === 'object' && payload.alreadyAttempted) {
      return result
    }

    const errorMessage =
      typeof payload === 'string'
        ? payload
        : typeof payload === 'object' && payload !== null
          ? (payload.detail || payload.message || 'An error occurred')
          : 'An error occurred'

    store.dispatch(showNotification({
      type: 'error',
      message: typeof errorMessage === 'string' ? errorMessage : 'An error occurred',
      duration: 5000,
    }))
  }
  
  // Check if action is fulfilled (success)
  if (action.type && action.type.endsWith('/fulfilled')) {
    // Show success notifications for specific actions
    if (action.type.includes('login/fulfilled')) {
      store.dispatch(showNotification({
        type: 'success',
        message: 'Successfully logged in!',
        duration: 3000,
      }))
    } else if (action.type.includes('register/fulfilled')) {
      store.dispatch(showNotification({
        type: 'success',
        message: 'Account created successfully!',
        duration: 3000,
      }))
    } else if (action.type.includes('updateProfile/fulfilled')) {
      store.dispatch(showNotification({
        type: 'success',
        message: 'Profile updated successfully!',
        duration: 3000,
      }))
    } else if (action.type.includes('submitPaperAttempt/fulfilled')) {
      store.dispatch(showNotification({
        type: 'success',
        message: 'Paper submitted successfully!',
        duration: 3000,
      }))
    }
  }
  
  return result
}
