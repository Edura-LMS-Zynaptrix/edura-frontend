/**
 * Chat API Client
 *
 * Edura has no chat service among its 11 microservices — there is nothing for
 * these calls to reach. Reads return empty results so the chat UI renders an
 * empty state instead of crashing; writes reject with a clear message.
 */

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

export const sendMessage = async (_message: string, _sessionId?: string): Promise<ChatMessage> => {
  throw new Error('Chat is not supported by the Edura backend yet.')
}

export const getHistory = async (_sessionId?: string): Promise<ChatMessage[]> => {
  return []
}

export const syncChatSession = async (_sessionId: string): Promise<any> => {
  throw new Error('Chat is not supported by the Edura backend yet.')
}

// --- Admin APIs ---

export const getAdminConversations = async (): Promise<ChatConversation[]> => {
  return []
}

export const getAdminConversationMessages = async (_conversationId: string): Promise<ChatMessage[]> => {
  return []
}

export const adminReply = async (_conversationId: string, _message: string): Promise<ChatMessage> => {
  throw new Error('Chat is not supported by the Edura backend yet.')
}

export const deleteAdminConversation = async (_conversationId: string): Promise<any> => {
  throw new Error('Chat is not supported by the Edura backend yet.')
}

export const getAdminConversationByStudent = async (_userId: string): Promise<ChatConversation> => {
  throw new Error('Chat is not supported by the Edura backend yet.')
}
