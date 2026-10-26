jest.mock('@/lib/api/chat');
jest.mock('@/lib/api/feedback');
jest.mock('@/lib/api/student');
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock());

import apiClient from '@/lib/api/client';
import * as chatApi from '@/lib/api/chat';
import * as feedbackApi from '@/lib/api/feedback';
import * as studentApi from '@/lib/api/student';
import * as badges from '@/lib/redux/slices/badgesSlice';
import * as chat from '@/lib/redux/slices/chatSlice';
import * as feedback from '@/lib/redux/slices/feedbackSlice';
import * as referral from '@/lib/redux/slices/referralSlice';
import { httpError, reply, type MockClient } from '@/test-utils/api';
import { makeStore } from '@/test-utils/store';

const chatMock = chatApi as jest.Mocked<typeof chatApi>;
const feedbackMock = feedbackApi as jest.Mocked<typeof feedbackApi>;
const studentMock = studentApi as jest.Mocked<typeof studentApi>;
const http = apiClient as unknown as MockClient;
const fail = (message: string) =>
  Object.assign(new Error('x'), {
    response: { data: { detail: { message } } },
  });

beforeEach(() => jest.resetAllMocks());

describe('chat slice — student side', () => {
  it('remembers the guest session id in the browser', () => {
    const store = makeStore();
    store.dispatch(chat.setSessionId('sess-1'));
    expect(store.getState().chat.sessionId).toBe('sess-1');
    expect(localStorage.getItem('chat_session_id')).toBe('sess-1');
  });

  it('shows a spinner only for the first load, then polls quietly', async () => {
    chatMock.getHistory.mockResolvedValue([{ id: '1' }] as any);
    const store = makeStore();
    const first = store.dispatch(chat.fetchChatHistoryThunk('sess-1'));
    expect(store.getState().chat).toMatchObject({
      isLoading: true,
      isPolling: true,
    });
    await first;
    expect(chatMock.getHistory).toHaveBeenCalledWith('sess-1');

    const poll = store.dispatch(chat.fetchChatHistoryThunk(undefined));
    expect(store.getState().chat).toMatchObject({
      isLoading: false,
      isPolling: true,
    });
    await poll;
    expect(store.getState().chat.isPolling).toBe(false);
  });

  it('appends a sent message', async () => {
    chatMock.sendMessage.mockResolvedValue({ id: '2', message: 'Hi' } as any);
    const store = makeStore({ chat: { messages: [{ id: '1' }] as any } });
    await store.dispatch(
      chat.sendMessageThunk({ message: 'Hi', sessionId: 's' })
    );
    expect(chatMock.sendMessage).toHaveBeenCalledWith('Hi', 's');
    expect(store.getState().chat.messages.map((m) => m.id)).toEqual(['1', '2']);
  });

  it('syncs a guest thread', async () => {
    chatMock.syncChatSession.mockResolvedValue({ message: 'ok' });
    expect(
      (await makeStore().dispatch(chat.syncChatThunk('s'))).payload
    ).toEqual({ message: 'ok' });
  });

  it.each([
    [
      'fetchChatHistoryThunk',
      () => chat.fetchChatHistoryThunk('s'),
      'getHistory',
    ],
    [
      'fetchAdminConversationsThunk',
      () => chat.fetchAdminConversationsThunk(),
      'getAdminConversations',
    ],
    [
      'fetchAdminMessagesThunk',
      () => chat.fetchAdminMessagesThunk('2'),
      'getAdminConversationMessages',
    ],
    [
      'deleteAdminConversationThunk',
      () => chat.deleteAdminConversationThunk('2'),
      'deleteAdminConversation',
    ],
    [
      'initiateConversationWithStudentThunk',
      () => chat.initiateConversationWithStudentThunk('7'),
      'getAdminConversationByStudent',
    ],
  ] as const)(
    '%s records failures and stops spinning',
    async (_n, thunk, apiName) => {
      (chatMock as any)[apiName].mockRejectedValue(fail('Offline'));
      const store = makeStore();
      await store.dispatch(thunk() as any);
      expect(store.getState().chat).toMatchObject({
        error: 'Offline',
        isLoading: false,
        isPolling: false,
      });
      store.dispatch(chat.clearChatError());
      expect(store.getState().chat.error).toBeNull();
    }
  );

  it.each([
    [
      'sendMessageThunk',
      () => chat.sendMessageThunk({ message: 'x' }),
      'sendMessage',
    ],
    ['syncChatThunk', () => chat.syncChatThunk('s'), 'syncChatSession'],
    [
      'adminReplyThunk',
      () => chat.adminReplyThunk({ conversationId: '2', message: 'x' }),
      'adminReply',
    ],
  ] as const)(
    '%s rejects with the server message',
    async (_n, thunk, apiName) => {
      (chatMock as any)[apiName].mockRejectedValue(fail('Offline'));
      expect((await makeStore().dispatch(thunk() as any)).payload).toBe(
        'Offline'
      );
    }
  );
});

describe('chat slice — admin inbox', () => {
  it('loads conversations, quietly when polling', async () => {
    chatMock.getAdminConversations.mockResolvedValue([{ id: '2' }] as any);
    const store = makeStore();
    const first = store.dispatch(chat.fetchAdminConversationsThunk());
    expect(store.getState().chat.isConversationsLoading).toBe(true);
    await first;
    const poll = store.dispatch(chat.fetchAdminConversationsThunk());
    expect(store.getState().chat).toMatchObject({
      isConversationsLoading: false,
      isConversationsPolling: true,
    });
    await poll;
    expect(store.getState().chat.conversations).toEqual([{ id: '2' }]);
  });

  it('opens a conversation and replies', async () => {
    chatMock.getAdminConversationMessages.mockResolvedValue([
      { id: '1' },
    ] as any);
    chatMock.adminReply.mockResolvedValue({
      id: '2',
      is_from_admin: true,
    } as any);
    const store = makeStore();
    store.dispatch(chat.setActiveConversation('2'));
    await store.dispatch(chat.fetchAdminMessagesThunk('2'));
    const poll = store.dispatch(chat.fetchAdminMessagesThunk('2'));
    expect(store.getState().chat.isLoading).toBe(false); // messages already shown
    await poll;
    await store.dispatch(
      chat.adminReplyThunk({ conversationId: '2', message: 'Hi' })
    );
    expect(store.getState().chat.messages.map((m) => m.id)).toEqual(['1', '2']);
  });

  it('deleting the open conversation also closes it', async () => {
    chatMock.deleteAdminConversation.mockResolvedValue({ message: 'ok' });
    const store = makeStore({
      chat: {
        conversations: [{ id: '2' }, { id: '3' }] as any,
        activeConversationId: '2',
        messages: [{ id: 'm' }] as any,
      },
    });
    await store.dispatch(chat.deleteAdminConversationThunk('2'));
    expect(store.getState().chat).toMatchObject({
      conversations: [{ id: '3' }],
      activeConversationId: null,
      messages: [],
    });

    await store.dispatch(chat.deleteAdminConversationThunk('3')); // not the open one
    expect(store.getState().chat.conversations).toEqual([]);
  });

  it('keeps the open conversation when another is deleted', async () => {
    chatMock.deleteAdminConversation.mockResolvedValue({ message: 'ok' });
    const store = makeStore({
      chat: {
        conversations: [{ id: '2' }, { id: '3' }] as any,
        activeConversationId: '3',
        messages: [{ id: 'm' }] as any,
      },
    });
    await store.dispatch(chat.deleteAdminConversationThunk('2'));
    expect(store.getState().chat).toMatchObject({
      activeConversationId: '3',
      messages: [{ id: 'm' }],
    });
  });

  it('starting a chat with a student opens it and lists it once', async () => {
    chatMock.getAdminConversationByStudent.mockResolvedValue({
      id: '9',
      student_name: 'Ama',
    } as any);
    const store = makeStore({ chat: { conversations: [{ id: '2' }] as any } });
    await store.dispatch(chat.initiateConversationWithStudentThunk('7'));
    await store.dispatch(chat.initiateConversationWithStudentThunk('7'));
    expect(store.getState().chat.activeConversationId).toBe('9');
    expect(store.getState().chat.conversations.map((c) => c.id)).toEqual([
      '9',
      '2',
    ]);
  });
});

describe('feedback slice', () => {
  const item = (id: string, extra = {}) =>
    ({ id, is_read: false, ...extra }) as any;

  it('submits feedback and reports success', async () => {
    feedbackMock.submitFeedback.mockResolvedValue(item('1'));
    const store = makeStore();
    const pending = store.dispatch(
      feedback.submitFeedbackThunk({
        name: 'A',
        email: 'a@x.lk',
        category: 'bug',
        message: 'm',
      })
    );
    expect(store.getState().feedback).toMatchObject({
      isSubmitting: true,
      success: false,
    });
    await pending;
    expect(store.getState().feedback).toMatchObject({
      isSubmitting: false,
      success: true,
    });
    store.dispatch(feedback.clearFeedbackStatus());
    expect(store.getState().feedback).toMatchObject({
      success: false,
      error: null,
    });

    feedbackMock.submitFeedback.mockRejectedValue(fail('Invalid email'));
    await store.dispatch(feedback.submitFeedbackThunk({} as any));
    expect(store.getState().feedback).toMatchObject({
      isSubmitting: false,
      error: 'Invalid email',
    });
  });

  it('lists, marks read and deletes feedback', async () => {
    feedbackMock.getAllFeedback.mockResolvedValue([item('1'), item('2')]);
    feedbackMock.markFeedbackAsRead.mockResolvedValue(
      item('1', { is_read: true })
    );
    feedbackMock.deleteFeedback.mockResolvedValue();
    const store = makeStore();

    await store.dispatch(feedback.fetchAllFeedbackThunk());
    store.dispatch(feedback.setActiveFeedback('2'));
    await store.dispatch(feedback.markReadThunk('1'));
    feedbackMock.markFeedbackAsRead.mockResolvedValue(item('404'));
    await store.dispatch(feedback.markReadThunk('404'));
    expect(store.getState().feedback.items.map((i) => i.is_read)).toEqual([
      true,
      false,
    ]);

    await store.dispatch(feedback.deleteFeedbackThunk('2'));
    expect(store.getState().feedback).toMatchObject({
      items: [item('1', { is_read: true })],
      activeFeedbackId: null,
    });
    store.dispatch(feedback.setActiveFeedback('1'));
    feedbackMock.getAllFeedback.mockResolvedValue([item('1'), item('3')]);
    await store.dispatch(feedback.fetchAllFeedbackThunk());
    await store.dispatch(feedback.deleteFeedbackThunk('3'));
    expect(store.getState().feedback.activeFeedbackId).toBe('1');
  });

  it.each([
    [
      'fetchAllFeedbackThunk',
      () => feedback.fetchAllFeedbackThunk(),
      'getAllFeedback',
    ],
    ['markReadThunk', () => feedback.markReadThunk('1'), 'markFeedbackAsRead'],
    [
      'deleteFeedbackThunk',
      () => feedback.deleteFeedbackThunk('1'),
      'deleteFeedback',
    ],
  ] as const)(
    '%s rejects with the server message',
    async (_n, thunk, apiName) => {
      (feedbackMock as any)[apiName].mockRejectedValue(fail('Forbidden'));
      const store = makeStore();
      const res = await store.dispatch(thunk() as any);
      expect(res.payload).toBe('Forbidden');
      expect(store.getState().feedback.isLoading).toBe(false);
    }
  );
});

describe('referral slice', () => {
  it('loads the summary and events', async () => {
    studentMock.getReferralSummary.mockResolvedValue({
      referral_code: 'AMA1',
    } as any);
    studentMock.getReferralEvents.mockResolvedValue({
      events: [{ event_id: '1' }],
    } as any);
    const store = makeStore();
    await store.dispatch(referral.fetchReferralSummary());
    await store.dispatch(referral.fetchReferralEvents(5));
    expect(studentMock.getReferralEvents).toHaveBeenCalledWith(5);
    expect(store.getState().referral).toMatchObject({
      summary: { referral_code: 'AMA1' },
      events: [{ event_id: '1' }],
      loadingSummary: false,
      loadingEvents: false,
    });
  });

  it('defaults the events limit to 50', async () => {
    studentMock.getReferralEvents.mockResolvedValue({ events: [] });
    await makeStore().dispatch(referral.fetchReferralEvents(undefined as any));
    expect(studentMock.getReferralEvents).toHaveBeenCalledWith(50);
  });

  it('applies a code then refreshes the summary and events', async () => {
    studentMock.applyReferralCode.mockResolvedValue({
      message: 'Applied',
      credit_amount: 0,
    });
    studentMock.getReferralSummary.mockResolvedValue({
      referral_code: 'ME',
    } as any);
    studentMock.getReferralEvents.mockResolvedValue({ events: [] });
    const store = makeStore();
    const pending = store.dispatch(referral.applyReferralCodeThunk('KAMAL1'));
    expect(store.getState().referral.applyingCode).toBe(true);
    expect((await pending).payload).toEqual({
      message: 'Applied',
      credit_amount: 0,
    });
    expect(studentMock.getReferralSummary).toHaveBeenCalled();
    expect(studentMock.getReferralEvents).toHaveBeenCalledWith(50);
    expect(store.getState().referral.applyingCode).toBe(false);
  });

  it.each([
    [
      'fetchReferralSummary',
      () => referral.fetchReferralSummary(),
      'getReferralSummary',
      'loadingSummary',
    ],
    [
      'fetchReferralEvents',
      () => referral.fetchReferralEvents(5),
      'getReferralEvents',
      'loadingEvents',
    ],
    [
      'applyReferralCodeThunk',
      () => referral.applyReferralCodeThunk('X'),
      'applyReferralCode',
      'applyingCode',
    ],
  ] as const)('%s records failures', async (_n, thunk, apiName, loading) => {
    (studentMock as any)[apiName].mockRejectedValue(
      fail('Invalid referral code')
    );
    const store = makeStore();
    await store.dispatch(thunk() as any);
    expect(store.getState().referral).toMatchObject({
      error: 'Invalid referral code',
      [loading]: false,
    });
    store.dispatch(referral.clearReferralError());
    expect(store.getState().referral.error).toBeNull();
  });
});

describe('badges slice', () => {
  it('loads the badge dashboard', async () => {
    http.get.mockReturnValue(
      reply({ available_badges: [{ id: '1' }], earned_badges: [{ id: 'e' }] })
    );
    const store = makeStore();
    const pending = store.dispatch(badges.fetchBadgeDashboard());
    expect(store.getState().badges.isLoading).toBe(true);
    await pending;
    expect(http.get).toHaveBeenCalledWith('/api/assessments/badges/dashboard');
    expect(store.getState().badges).toMatchObject({
      availableBadges: [{ id: '1' }],
      earnedBadges: [{ id: 'e' }],
      isLoading: false,
    });
  });

  it('reports a failed dashboard load with the server detail or a fallback', async () => {
    http.get.mockReturnValue(httpError(500, { detail: 'Down' }));
    const store = makeStore();
    await store.dispatch(badges.fetchBadgeDashboard());
    expect(store.getState().badges).toMatchObject({
      error: 'Down',
      isLoading: false,
    });

    http.get.mockReturnValue(httpError(500));
    await store.dispatch(badges.fetchBadgeDashboard());
    expect(store.getState().badges.error).toBe('Failed to fetch badges');
  });

  it('loads earned badges', async () => {
    http.get.mockReturnValue(reply([{ id: 'e' }]));
    const store = makeStore();
    await store.dispatch(badges.fetchMyBadges());
    expect(http.get).toHaveBeenCalledWith('/api/assessments/badges/my');
    expect(store.getState().badges.earnedBadges).toEqual([{ id: 'e' }]);

    http.get.mockReturnValue(httpError(500));
    expect((await store.dispatch(badges.fetchMyBadges())).payload).toBe(
      'Failed to fetch earned badges'
    );
  });

  it('queues and clears badge celebrations', () => {
    const store = makeStore();
    store.dispatch(badges.setNewlyEarned([{ id: '1' } as any]));
    expect(store.getState().badges.newlyEarned).toHaveLength(1);
    store.dispatch(badges.clearNewlyEarned());
    expect(store.getState().badges.newlyEarned).toEqual([]);
  });
});
