/**
 * Chat Redux Slice
 */
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import * as chatApi from '@/lib/api/chat'
import { getErrorMessage } from '@/lib/utils'

interface ChatState {
  messages: chatApi.ChatMessage[]
  conversations: chatApi.ChatConversation[]
  activeConversationId: string | null
  isLoading: boolean
  isPolling: boolean
  isConversationsLoading: boolean
  isConversationsPolling: boolean
  error: string | null
  sessionId: string | null
}

const initialState: ChatState = {
  messages: [],
  conversations: [],
  activeConversationId: null,
  isLoading: false,
  isPolling: false,
  isConversationsLoading: false,
  isConversationsPolling: false,
  error: null,
  sessionId: typeof window !== 'undefined' ? localStorage.getItem('chat_session_id') : null
}

// Thunks
export const fetchChatHistoryThunk = createAsyncThunk(
  'chat/fetchHistory',
  async (sessionId: string | undefined, { rejectWithValue }) => {
    try {
      return await chatApi.getHistory(sessionId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const sendMessageThunk = createAsyncThunk(
  'chat/sendMessage',
  async ({ message, sessionId }: { message: string, sessionId?: string }, { rejectWithValue }) => {
    try {
      return await chatApi.sendMessage(message, sessionId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const syncChatThunk = createAsyncThunk(
  'chat/sync',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      return await chatApi.syncChatSession(sessionId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

// Admin Thunks
export const fetchAdminConversationsThunk = createAsyncThunk(
  'chat/admin/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      return await chatApi.getAdminConversations()
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const fetchAdminMessagesThunk = createAsyncThunk(
  'chat/admin/fetchMessages',
  async (conversationId: string, { rejectWithValue }) => {
    try {
      return await chatApi.getAdminConversationMessages(conversationId)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const adminReplyThunk = createAsyncThunk(
  'chat/admin/reply',
  async ({ conversationId, message }: { conversationId: string, message: string }, { rejectWithValue }) => {
    try {
      return await chatApi.adminReply(conversationId, message)
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const deleteAdminConversationThunk = createAsyncThunk(
  'chat/admin/deleteConversation',
  async (conversationId: string, { dispatch, rejectWithValue }) => {
    try {
      await chatApi.deleteAdminConversation(conversationId)
      return conversationId
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

export const initiateConversationWithStudentThunk = createAsyncThunk(
  'chat/admin/initiateWithStudent',
  async (userId: string, { dispatch, rejectWithValue }) => {
    try {
      const conv = await chatApi.getAdminConversationByStudent(userId)
      dispatch(setActiveConversation(conv.id))
      return conv
    } catch (error: any) {
      return rejectWithValue(getErrorMessage(error))
    }
  }
)

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload
      if (typeof window !== 'undefined') {
        localStorage.setItem('chat_session_id', action.payload)
      }
    },
    setActiveConversation: (state, action: PayloadAction<string | null>) => {
      state.activeConversationId = action.payload
    },
    clearChatError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchChatHistoryThunk
      .addCase(fetchChatHistoryThunk.pending, (state) => {
        if (state.messages.length === 0) {
          state.isLoading = true
        }
        state.isPolling = true
        state.error = null
      })
      .addCase(fetchChatHistoryThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.isPolling = false
        state.messages = action.payload
      })
      .addCase(fetchChatHistoryThunk.rejected, (state, action) => {
        state.isLoading = false
        state.isPolling = false
        state.error = action.payload as string
      })

      // sendMessageThunk
      .addCase(sendMessageThunk.fulfilled, (state, action) => {
        state.messages.push(action.payload)
      })

      // Admin fetchConversations
      .addCase(fetchAdminConversationsThunk.pending, (state) => {
        if (state.conversations.length === 0) {
          state.isConversationsLoading = true
        }
        state.isConversationsPolling = true
      })
      .addCase(fetchAdminConversationsThunk.fulfilled, (state, action) => {
        state.isConversationsLoading = false
        state.isConversationsPolling = false
        state.conversations = action.payload
      })
      .addCase(fetchAdminConversationsThunk.rejected, (state, action) => {
        state.isConversationsLoading = false
        state.isConversationsPolling = false
        state.error = action.payload as string
      })

      // Admin fetchMessages
      .addCase(fetchAdminMessagesThunk.pending, (state) => {
        if (state.messages.length === 0) {
          state.isLoading = true
        }
        state.isPolling = true
      })
      .addCase(fetchAdminMessagesThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.isPolling = false
        state.messages = action.payload
      })
      .addCase(fetchAdminMessagesThunk.rejected, (state, action) => {
        state.isLoading = false
        state.isPolling = false
        state.error = action.payload as string
      })

      // Admin reply
      .addCase(adminReplyThunk.fulfilled, (state, action) => {
        state.messages.push(action.payload)
      })

      // Admin delete conversation
      .addCase(deleteAdminConversationThunk.pending, (state) => {
        state.isLoading = true
      })
      .addCase(deleteAdminConversationThunk.fulfilled, (state, action) => {
        state.isLoading = false
        state.conversations = state.conversations.filter(c => c.id !== action.payload)
        if (state.activeConversationId === action.payload) {
          state.activeConversationId = null
          state.messages = []
        }
      })
      .addCase(deleteAdminConversationThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Admin initiate with student
      .addCase(initiateConversationWithStudentThunk.pending, (state) => {
        state.isLoading = true
      })
      .addCase(initiateConversationWithStudentThunk.fulfilled, (state, action) => {
        state.isLoading = false
        // Add to conversations if not already there
        if (!state.conversations.find(c => c.id === action.payload.id)) {
          state.conversations.unshift(action.payload)
        }
      })
      .addCase(initiateConversationWithStudentThunk.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  }
})

export const { setSessionId, setActiveConversation, clearChatError } = chatSlice.actions
export default chatSlice.reducer
