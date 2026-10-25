jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())

import api from '@/lib/api/client'
import * as chat from '@/lib/api/chat'
import * as feedback from '@/lib/api/feedback'
import { reply, type MockClient } from '@/test-utils/api'

const http = api as unknown as MockClient

const rawMessage = (overrides = {}) => ({
  id: 1,
  conversation_id: 2,
  message: 'Hello',
  is_from_admin: false,
  is_read: false,
  sender_id: 7,
  created_at: '2026-10-01T00:00:00Z',
  ...overrides,
})

const rawConversation = (overrides = {}) => ({
  id: 2,
  session_id: null,
  user_id: 7,
  student_name: 'Ama',
  last_message: null,
  last_message_at: '2026-10-01T00:00:00Z',
  unread_count: 3,
  is_active: true,
  ...overrides,
})

beforeEach(() => jest.resetAllMocks())

describe('chat api', () => {
  it('sends a message, with the guest session only when there is one', async () => {
    http.post.mockReturnValue(reply(rawMessage()))
    expect(await chat.sendMessage('Hi', 'sess-1')).toEqual({
      id: '1',
      conversation_id: '2',
      message: 'Hello',
      is_from_admin: false,
      is_read: false,
      sender_id: '7',
      created_at: '2026-10-01T00:00:00Z',
    })
    expect(http.post).toHaveBeenCalledWith('/api/admin/chat/send', {
      message: 'Hi',
      session_id: 'sess-1',
    })

    await chat.sendMessage('Hi', '')
    expect(http.post).toHaveBeenLastCalledWith('/api/admin/chat/send', {
      message: 'Hi',
      session_id: undefined,
    })
  })

  it('loads history for a guest session or the signed-in user', async () => {
    http.get.mockReturnValue(reply([rawMessage({ sender_id: null })]))
    const [msg] = await chat.getHistory('sess-1')
    expect(msg.sender_id).toBeUndefined()
    expect(http.get).toHaveBeenCalledWith('/api/admin/chat/history', {
      params: { session_id: 'sess-1' },
    })
    await chat.getHistory()
    expect(http.get).toHaveBeenLastCalledWith('/api/admin/chat/history', { params: {} })
  })

  it('syncs a guest thread on login', async () => {
    http.post.mockReturnValue(reply({ message: 'Chat session synced' }))
    expect(await chat.syncChatSession('sess-1')).toEqual({ message: 'Chat session synced' })
    expect(http.post).toHaveBeenCalledWith('/api/admin/chat/sync', { session_id: 'sess-1' })
  })

  it('maps admin conversations', async () => {
    http.get.mockReturnValue(reply([rawConversation(), rawConversation({ id: 3, user_id: null, session_id: 'g' })]))
    const [signedIn, guest] = await chat.getAdminConversations()
    expect(signedIn).toEqual({
      id: '2',
      session_id: undefined,
      user_id: '7',
      student_name: 'Ama',
      last_message: '',
      last_message_at: '2026-10-01T00:00:00Z',
      unread_count: 3,
      is_active: true,
    })
    expect(guest).toMatchObject({ user_id: undefined, session_id: 'g' })
  })

  it('reads, replies to and deletes a conversation', async () => {
    http.get.mockReturnValue(reply([rawMessage()]))
    http.post.mockReturnValue(reply(rawMessage({ is_from_admin: true })))
    http.delete.mockReturnValue(reply(null))

    expect(await chat.getAdminConversationMessages('2')).toHaveLength(1)
    expect(http.get).toHaveBeenCalledWith('/api/admin/chat/admin/conversations/2/messages')
    expect((await chat.adminReply('2', 'Hi')).is_from_admin).toBe(true)
    expect(http.post).toHaveBeenCalledWith('/api/admin/chat/admin/conversations/2/reply', {
      message: 'Hi',
    })
    expect(await chat.deleteAdminConversation('2')).toEqual({
      message: 'Conversation deleted',
    })
    expect(http.delete).toHaveBeenCalledWith('/api/admin/chat/admin/conversations/2')
  })

  it('opens the thread with a student', async () => {
    http.get.mockReturnValue(reply(rawConversation()))
    expect((await chat.getAdminConversationByStudent('7')).id).toBe('2')
    expect(http.get).toHaveBeenCalledWith('/api/admin/chat/admin/conversations/student/7')
  })
})

describe('feedback api', () => {
  const raw = {
    id: 4,
    user_id: null,
    name: 'Ama',
    email: 'a@x.lk',
    category: 'bug',
    subject: null,
    message: 'Broken',
    is_read: false,
    is_resolved: false,
    created_at: '2026-10-01T00:00:00Z',
  }

  it('submits feedback and maps optional fields', async () => {
    http.post.mockReturnValue(reply(raw))
    const body = { name: 'Ama', email: 'a@x.lk', category: 'bug', message: 'Broken' }
    expect(await feedback.submitFeedback(body)).toEqual({
      ...raw,
      id: '4',
      user_id: undefined,
      subject: undefined,
    })
    expect(http.post).toHaveBeenCalledWith('/api/admin/feedback/submit', body)
  })

  it('lists feedback with paging', async () => {
    http.get.mockReturnValue(reply([{ ...raw, user_id: 7, subject: 'Hi' }]))
    const [item] = await feedback.getAllFeedback(20, 10)
    expect(item).toMatchObject({ user_id: '7', subject: 'Hi' })
    expect(http.get).toHaveBeenCalledWith('/api/admin/feedback/admin/all', {
      params: { skip: 20, limit: 10 },
    })
    await feedback.getAllFeedback()
    expect(http.get).toHaveBeenLastCalledWith('/api/admin/feedback/admin/all', {
      params: { skip: 0, limit: 100 },
    })
  })

  it('marks read and deletes', async () => {
    http.patch.mockReturnValue(reply({ ...raw, is_read: true }))
    http.delete.mockReturnValue(reply(null))
    expect((await feedback.markFeedbackAsRead('4')).is_read).toBe(true)
    expect(http.patch).toHaveBeenCalledWith('/api/admin/feedback/admin/4/read')
    await feedback.deleteFeedback('4')
    expect(http.delete).toHaveBeenCalledWith('/api/admin/feedback/admin/4')
  })
})
