jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())
jest.mock('@/lib/api/chat')
jest.mock('@/lib/api/feedback')
jest.mock('@/components/admin/StudentSearchModal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose, onSelectStudent }: any) =>
    isOpen ? (
      <div role="dialog" aria-label="student search">
        <button onClick={() => onSelectStudent({ user_id: 'u5', full_name: 'Nimali' })}>Pick Nimali</button>
        <button onClick={onClose}>Close search</button>
      </div>
    ) : null,
}))

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as chatApi from '@/lib/api/chat'
import * as feedbackApi from '@/lib/api/feedback'
import AdminMessagesPage from '@/app/admin/messages/page'
import { httpError } from '@/test-utils/api'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const chat = chatApi as jest.Mocked<typeof chatApi>
const feedback = feedbackApi as jest.Mocked<typeof feedbackApi>

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
const conv = (id: string, extra: any = {}) => ({
  id, user_id: `u-${id}`, student_name: `Student ${id}`, last_message: `Hello from ${id}`, last_message_at: daysAgo(0), unread_count: 0, ...extra,
})
const conversations = [
  conv('c1', { unread_count: 2 }),
  conv('c2'),
  conv('c3', { last_message_at: daysAgo(1), user_id: null, student_name: 'Guest 42', last_message: null }),
  conv('c4', { last_message_at: daysAgo(10) }),
]
const messages = [
  { id: 'm1', message: 'I cannot open my exam', is_from_admin: false, is_read: true, created_at: daysAgo(0) },
  { id: 'm2', message: 'Try logging in again', is_from_admin: true, is_read: false, created_at: daysAgo(0) },
]
const feedbackItems = [
  { id: 'f1', name: 'Kasun', email: 'kasun@example.com', category: 'bug', subject: 'Timer froze', message: 'The timer stopped', is_read: false, created_at: daysAgo(0) },
  { id: 'f2', name: 'Amaya', email: 'amaya@example.com', category: 'suggestion', subject: null, message: 'Add dark mode', is_read: true, created_at: daysAgo(2) },
]

const asAdmin = (extra: any = {}) =>
  makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: 'a1', email: 'admin@edura.lk', role: 'admin' } as any }, ...extra })

beforeEach(() => {
  nav.reset()
  jest.resetAllMocks()
  chat.getAdminConversations.mockResolvedValue(conversations as any)
  chat.getAdminConversationMessages.mockResolvedValue(messages as any)
  feedback.getAllFeedback.mockResolvedValue(feedbackItems as any)
})

const sidebar = () => screen.getByText('Back to Dashboard').closest('.fixed') as HTMLElement

describe('Admin messages', () => {
  it('sends non-admins home and renders nothing', () => {
    const { container } = renderWithStore(<AdminMessagesPage />, {
      store: makeStore({ auth: { user: { id: 's1', role: 'student' } as any } }),
    })
    expect(nav.router.push).toHaveBeenCalledWith('/')
    expect(container).toBeEmptyDOMElement()
  })

  it('groups conversations by unread and recency', async () => {
    renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
    expect(await screen.findByText('Student c1')).toBeInTheDocument()
    expect(within(sidebar()).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Active Now', 'Today', 'Yesterday', 'Previous',
    ])
    expect(screen.getByText('No messages yet')).toBeInTheDocument()
    expect(screen.getByText('admin@edura.lk')).toBeInTheDocument()
    expect(screen.getByText('Edura Support')).toBeInTheDocument()
  })

  it('shows a loader while conversations sync', () => {
    chat.getAdminConversations.mockReturnValue(new Promise(() => {}))
    renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
    expect(screen.getByText('Synchronizing threads...')).toBeInTheDocument()
  })

  it('searches by name and last message', async () => {
    renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
    await screen.findByText('Student c1')
    await userEvent.type(screen.getByPlaceholderText('Search students...'), 'guest')
    expect(screen.getByText('Guest 42')).toBeInTheDocument()
    expect(screen.queryByText('Student c1')).not.toBeInTheDocument()
    await userEvent.clear(screen.getByPlaceholderText('Search students...'))
    await userEvent.type(screen.getByPlaceholderText('Search students...'), 'from c4')
    expect(screen.getByText('Student c4')).toBeInTheDocument()
    expect(screen.queryByText('Student c2')).not.toBeInTheDocument()
  })

  it('opens a conversation and its messages', async () => {
    renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
    await userEvent.click(await screen.findByText('Student c1'))
    expect(await screen.findByText('I cannot open my exam')).toBeInTheDocument()
    expect(chat.getAdminConversationMessages).toHaveBeenCalledWith('c1')
    expect(screen.getByRole('heading', { name: 'Student c1' })).toBeInTheDocument()
    expect(screen.getByText('Authenticated Student')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Guest 42'))
    expect(await screen.findByText('Guest Visitor')).toBeInTheDocument()
  })

  it('closes the sidebar on small screens when a conversation is picked', async () => {
    const width = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    try {
      renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
      await userEvent.click(await screen.findByText('Student c2'))
      await waitFor(() => expect(screen.queryByText('Back to Dashboard')).not.toBeInTheDocument())
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    }
  })

  it('toggles the sidebar from the header', async () => {
    renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
    await screen.findByText('Student c1')
    const menu = screen.getByRole('banner').querySelector('button') as HTMLElement
    await userEvent.click(menu)
    await waitFor(() => expect(screen.queryByText('Back to Dashboard')).not.toBeInTheDocument())
    await userEvent.click(menu)
    expect(await screen.findByText('Back to Dashboard')).toBeInTheDocument()
  })

  it('leaves for the dashboard, clearing the selection', async () => {
    const { store } = renderWithStore(<AdminMessagesPage />, { store: asAdmin({ chat: { activeConversationId: 'c1' } }) })
    await userEvent.click(screen.getByText('Back to Dashboard'))
    expect(nav.router.push).toHaveBeenCalledWith('/admin/dashboard')
    expect(store.getState().chat.activeConversationId).toBeNull()
  })

  describe('replying', () => {
    const openChat = async () => {
      renderWithStore(<AdminMessagesPage />, { store: asAdmin({ chat: { activeConversationId: 'c1' } }) })
      await screen.findByText('I cannot open my exam')
    }

    it('sends with the button and refreshes the list', async () => {
      chat.adminReply.mockResolvedValue({ id: 'm3', message: 'Fixed now', is_from_admin: true, is_read: false, created_at: daysAgo(0) } as any)
      await openChat()
      const box = screen.getByPlaceholderText('Send a message...')
      const send = box.closest('form')!.querySelector('button[type="submit"]') as HTMLButtonElement
      expect(send).toBeDisabled()
      await userEvent.type(box, 'Fixed now')
      await userEvent.click(send)
      expect(chat.adminReply).toHaveBeenCalledWith('c1', 'Fixed now')
      expect(await screen.findByText('Fixed now')).toBeInTheDocument()
      expect(box).toHaveValue('')
      await waitFor(() => expect(chat.getAdminConversations).toHaveBeenCalledTimes(2))
    })

    it('sends on Enter but not Shift+Enter', async () => {
      chat.adminReply.mockResolvedValue({ id: 'm3', message: 'Hi', is_from_admin: true, created_at: daysAgo(0) } as any)
      await openChat()
      const box = screen.getByPlaceholderText('Send a message...')
      await userEvent.type(box, 'Hi{Shift>}{Enter}{/Shift}')
      expect(chat.adminReply).not.toHaveBeenCalled()
      await userEvent.type(box, '{Enter}')
      expect(chat.adminReply).toHaveBeenCalledWith('c1', 'Hi\n')
    })

    it('ignores blank replies', async () => {
      await openChat()
      fireEvent.submit(screen.getByPlaceholderText('Send a message...').closest('form')!)
      expect(chat.adminReply).not.toHaveBeenCalled()
    })

    it('puts the text back when sending fails', async () => {
      chat.adminReply.mockImplementation(() => httpError(500))
      await openChat()
      const box = screen.getByPlaceholderText('Send a message...')
      await userEvent.type(box, 'Lost message{Enter}')
      await waitFor(() => expect(box).toHaveValue('Lost message'))
    })
  })

  describe('deleting a conversation', () => {
    it('clears the open chat from the header', async () => {
      chat.deleteAdminConversation.mockResolvedValue(undefined as any)
      renderWithStore(<AdminMessagesPage />, { store: asAdmin({ chat: { activeConversationId: 'c1' } }) })
      await screen.findByText('I cannot open my exam')
      await userEvent.click(screen.getByRole('button', { name: /CLEAR CHAT/ }))
      expect(screen.getByRole('heading', { name: 'Clear Conversation?' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Yes, clear chat' }))
      expect(chat.deleteAdminConversation).toHaveBeenCalledWith('c1')
      expect(await screen.findByText('Select a student thread to begin assisting')).toBeInTheDocument()
      expect(screen.queryByText('Student c1')).not.toBeInTheDocument()
    })

    it('deletes from the sidebar without opening the chat', async () => {
      chat.deleteAdminConversation.mockResolvedValue(undefined as any)
      renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
      await screen.findByText('Student c2')
      await userEvent.click(within(screen.getByText('Student c2').closest('.group') as HTMLElement).getByTitle('Delete Chat'))
      expect(chat.getAdminConversationMessages).not.toHaveBeenCalled()
      await userEvent.click(screen.getByRole('button', { name: 'Yes, clear chat' }))
      expect(chat.deleteAdminConversation).toHaveBeenCalledWith('c2')
      await waitFor(() => expect(screen.queryByText('Student c2')).not.toBeInTheDocument())
    })

    it('shows a failed delete in the dialog', async () => {
      chat.deleteAdminConversation.mockImplementation(() => httpError(403, { detail: 'Not allowed' }))
      renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
      await userEvent.click(within((await screen.findByText('Student c2')).closest('.group') as HTMLElement).getByTitle('Delete Chat'))
      await userEvent.click(screen.getByRole('button', { name: 'Yes, clear chat' }))
      expect(await screen.findByText('Not allowed')).toBeInTheDocument()
    })

    it('cancel keeps the conversation', async () => {
      renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
      await userEvent.click(within((await screen.findByText('Student c2')).closest('.group') as HTMLElement).getByTitle('Delete Chat'))
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Clear Conversation?' })).not.toBeInTheDocument())
      expect(chat.deleteAdminConversation).not.toHaveBeenCalled()
    })
  })

  describe('starting a conversation', () => {
    it('finds the student\'s conversation and adds it to the list', async () => {
      chat.getAdminConversationByStudent.mockResolvedValue(conv('c9', { student_name: 'Nimali', unread_count: 1 }) as any)
      renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
      await screen.findByText('Student c1')
      await userEvent.click(screen.getByRole('button', { name: /New Conversation/ }))
      await userEvent.click(screen.getByRole('button', { name: 'Pick Nimali' }))
      expect(chat.getAdminConversationByStudent).toHaveBeenCalledWith('u5')
      expect(await screen.findByRole('heading', { name: 'Nimali' })).toBeInTheDocument() // and opens it
      expect(within(sidebar()).getByText('Nimali')).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: 'student search' })).not.toBeInTheDocument()
    })

    it('closes the search', async () => {
      renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
      await userEvent.click(screen.getByRole('button', { name: /New Conversation/ }))
      await userEvent.click(screen.getByRole('button', { name: 'Close search' }))
      expect(screen.queryByRole('dialog', { name: 'student search' })).not.toBeInTheDocument()
    })
  })

  describe('polling', () => {
    afterEach(() => jest.useRealTimers())

    it('refreshes conversations every 7s and the open chat every 5s', async () => {
      jest.useFakeTimers()
      renderWithStore(<AdminMessagesPage />, { store: asAdmin({ chat: { activeConversationId: 'c1' } }) })
      await act(async () => {})
      expect(chat.getAdminConversations).toHaveBeenCalledTimes(1)
      expect(chat.getAdminConversationMessages).toHaveBeenCalledTimes(1)
      await act(async () => { jest.advanceTimersByTime(5000) })
      expect(chat.getAdminConversationMessages).toHaveBeenCalledTimes(2)
      await act(async () => { jest.advanceTimersByTime(2000) })
      expect(chat.getAdminConversations).toHaveBeenCalledTimes(2)
    })
  })

  describe('feedback', () => {
    const openFeedback = async () => {
      renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
      await userEvent.click(screen.getByRole('button', { name: /FEEDBACK/ }))
      await screen.findByText('Kasun')
    }

    it('lists feedback and searches it', async () => {
      await openFeedback()
      expect(feedback.getAllFeedback).toHaveBeenCalled()
      expect(screen.getByText('Student Feedback', { selector: 'h3' })).toBeInTheDocument()
      expect(screen.getByText(/bug • The timer stopped/)).toBeInTheDocument()
      await userEvent.type(screen.getByPlaceholderText('Search feedback...'), 'dark')
      expect(screen.queryByText('Kasun')).not.toBeInTheDocument()
      expect(screen.getByText('Amaya')).toBeInTheDocument()
    })

    it('shows empty and loading states', async () => {
      let resolve!: (v: any) => void
      feedback.getAllFeedback.mockReturnValue(new Promise((r) => { resolve = r }))
      renderWithStore(<AdminMessagesPage />, { store: asAdmin() })
      await userEvent.click(screen.getByRole('button', { name: /FEEDBACK/ }))
      expect(screen.getByText('Fetching feedback...')).toBeInTheDocument()
      await act(async () => resolve([]))
      expect(screen.getByText('No feedback received yet')).toBeInTheDocument()
      expect(screen.getByText('Select a suggestion or report from the sidebar to view details')).toBeInTheDocument()
    })

    it('opens a feedback entry and marks it read', async () => {
      feedback.markFeedbackAsRead.mockResolvedValue({ ...feedbackItems[0], is_read: true } as any)
      await openFeedback()
      await userEvent.click(screen.getByText('Kasun'))
      expect(screen.getByRole('heading', { name: 'Timer froze' })).toBeInTheDocument()
      expect(screen.getByText('kasun@example.com')).toBeInTheDocument()
      expect(screen.getByText('Feedback Details')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /MARK AS READ/ }))
      expect(feedback.markFeedbackAsRead).toHaveBeenCalledWith('f1')
      await waitFor(() => expect(screen.queryByRole('button', { name: /MARK AS READ/ })).not.toBeInTheDocument())
    })

    it('shows read feedback without a mark-read button', async () => {
      await openFeedback()
      await userEvent.click(screen.getByText('Amaya'))
      expect(screen.getByText(/“Add dark mode”/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /MARK AS READ/ })).not.toBeInTheDocument()
    })

    it('deletes feedback from the header', async () => {
      feedback.deleteFeedback.mockResolvedValue(undefined as any)
      await openFeedback()
      await userEvent.click(screen.getByText('Kasun'))
      await userEvent.click(screen.getByRole('button', { name: /^DELETE$/ }))
      expect(screen.getByRole('heading', { name: 'Delete Feedback?' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Yes, delete feedback' }))
      expect(feedback.deleteFeedback).toHaveBeenCalledWith('f1')
      await waitFor(() => expect(screen.queryByText('Kasun')).not.toBeInTheDocument())
    })

    it('deletes feedback from the list and shows failures', async () => {
      feedback.deleteFeedback.mockImplementation(() => httpError(500, { detail: 'Delete failed' }))
      await openFeedback()
      const row = screen.getByText('Amaya').closest('.group') as HTMLElement
      await userEvent.click(within(row).getByRole('button'))
      await userEvent.click(screen.getByRole('button', { name: 'Yes, delete feedback' }))
      expect(await screen.findByText('Delete failed')).toBeInTheDocument()
      expect(feedback.deleteFeedback).toHaveBeenCalledWith('f2')
    })

    it('goes back to chats', async () => {
      await openFeedback()
      await userEvent.click(screen.getByRole('button', { name: /CHATS/ }))
      expect(await screen.findByText('Student c1')).toBeInTheDocument()
    })
  })
})
