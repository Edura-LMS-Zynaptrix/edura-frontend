/**
 * Feedback API Client — admin_service (/api/admin/feedback/...).
 * Anyone can submit; listing, marking read and deleting are admin-only.
 */

import apiClient from './client'

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

const mapFeedback = (f: any): Feedback => ({
  id: String(f.id),
  user_id: f.user_id != null ? String(f.user_id) : undefined,
  name: f.name,
  email: f.email,
  category: f.category,
  subject: f.subject ?? undefined,
  message: f.message,
  is_read: f.is_read,
  is_resolved: f.is_resolved,
  created_at: f.created_at,
})

/**
 * Submit feedback (Public)
 */
export const submitFeedback = async (feedback: FeedbackCreate): Promise<Feedback> => {
  const response = await apiClient.post('/api/admin/feedback/submit', feedback)
  return mapFeedback(response.data)
}

/**
 * Get all feedback (Admin)
 */
export const getAllFeedback = async (skip = 0, limit = 100): Promise<Feedback[]> => {
  const response = await apiClient.get('/api/admin/feedback/admin/all', { params: { skip, limit } })
  return response.data.map(mapFeedback)
}

/**
 * Mark feedback as read (Admin)
 */
export const markFeedbackAsRead = async (feedbackId: string): Promise<Feedback> => {
  const response = await apiClient.patch(`/api/admin/feedback/admin/${feedbackId}/read`)
  return mapFeedback(response.data)
}

/**
 * Delete feedback (Admin)
 */
export const deleteFeedback = async (feedbackId: string): Promise<void> => {
  await apiClient.delete(`/api/admin/feedback/admin/${feedbackId}`)
}
