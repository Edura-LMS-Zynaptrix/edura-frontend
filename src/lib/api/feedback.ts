/**
 * Feedback API Client
 *
 * Edura has no feedback service among its 11 microservices — nothing for
 * these calls to reach.
 */

export interface Feedback {
  id: string
  user_id?: string
  name: string
  email: string
  category: string
  subject?: string
  message: string
  is_read: boolean
  is_resolved: boolean
  created_at: string
}

export interface FeedbackCreate {
  name: string
  email: string
  category: string
  subject?: string
  message: string
}

/**
 * Submit feedback (Public)
 */
export const submitFeedback = async (_feedback: FeedbackCreate): Promise<Feedback> => {
  throw new Error('Feedback is not supported by the Edura backend yet.')
}

/**
 * Get all feedback (Admin)
 */
export const getAllFeedback = async (_skip = 0, _limit = 100): Promise<Feedback[]> => {
  return []
}

/**
 * Mark feedback as read (Admin)
 */
export const markFeedbackAsRead = async (_feedbackId: string): Promise<Feedback> => {
  throw new Error('Feedback is not supported by the Edura backend yet.')
}

/**
 * Delete feedback (Admin)
 */
export const deleteFeedback = async (_feedbackId: string): Promise<void> => {
  throw new Error('Feedback is not supported by the Edura backend yet.')
}
