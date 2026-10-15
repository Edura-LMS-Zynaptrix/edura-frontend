/**
 * Chat API Client — support chat in admin_service (/api/admin/chat/...).
 * Guests are identified by a random browser session id; signed-in users by
 * their token, and /sync attaches a guest thread to the account on login.
 */

import apiClient from './client'

export interface ChatMessage {
  id: string
  conversation_id: string
  message: string
  is_from_admin: boolean
  is_read: boolean
  sender_id?: string
  created_at: string
}

export interface ChatConversation {
  id: string
  session_id?: string
  user_id?: string
  student_name: string
  last_message: string
  last_message_at: string
  unread_count: number
  is_active: boolean
}

const mapMessage = (m: any): ChatMessage => ({
  id: String(m.id),
  conversation_id: String(m.conversation_id),
  message: m.message,
  is_from_admin: m.is_from_admin,
  is_read: m.is_read,
  sender_id: m.sender_id != null ? String(m.sender_id) : undefined,
  created_at: m.created_at,
})

const mapConversation = (c: any): ChatConversation => ({
  id: String(c.id),
  session_id: c.session_id ?? undefined,
  user_id: c.user_id != null ? String(c.user_id) : undefined,
  student_name: c.student_name,
  last_message: c.last_message ?? '',
  last_message_at: c.last_message_at,
  unread_count: c.unread_count,
  is_active: c.is_active,
})

export const sendMessage = async (message: string, sessionId?: string): Promise<ChatMessage> => {
  const response = await apiClient.post('/api/admin/chat/send', { message, session_id: sessionId || undefined })
  return mapMessage(response.data)
}

export const getHistory = async (sessionId?: string): Promise<ChatMessage[]> => {
  const response = await apiClient.get('/api/admin/chat/history', {
    params: sessionId ? { session_id: sessionId } : {},
  })
  return response.data.map(mapMessage)
}

export const syncChatSession = async (sessionId: string): Promise<any> => {
  const response = await apiClient.post('/api/admin/chat/sync', { session_id: sessionId })
  return response.data
}

// --- Admin APIs ---

export const getAdminConversations = async (): Promise<ChatConversation[]> => {
  const response = await apiClient.get('/api/admin/chat/admin/conversations')
  return response.data.map(mapConversation)
}

export const getAdminConversationMessages = async (conversationId: string): Promise<ChatMessage[]> => {
  const response = await apiClient.get(`/api/admin/chat/admin/conversations/${conversationId}/messages`)
  return response.data.map(mapMessage)
}

export const adminReply = async (conversationId: string, message: string): Promise<ChatMessage> => {
  const response = await apiClient.post(`/api/admin/chat/admin/conversations/${conversationId}/reply`, { message })
  return mapMessage(response.data)
}

export const deleteAdminConversation = async (conversationId: string): Promise<any> => {
  await apiClient.delete(`/api/admin/chat/admin/conversations/${conversationId}`)
  return { message: 'Conversation deleted' }
}

export const getAdminConversationByStudent = async (userId: string): Promise<ChatConversation> => {
  const response = await apiClient.get(`/api/admin/chat/admin/conversations/student/${userId}`)
  return mapConversation(response.data)
}
