jest.mock(
  'next/navigation',
  () => require('@/test-utils/navigation').navigationMock
);
jest.mock('@/lib/api/feedback');
jest.mock('@/lib/api/chat');

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as chatApi from '@/lib/api/chat';
import * as feedbackApi from '@/lib/api/feedback';
import ChatWidget from '@/components/chat/ChatWidget';
import FeedbackForm from '@/components/FeedbackForm';
import NotificationManager from '@/components/NotificationManager';
import { StatusModal } from '@/components/StatusModal';
import { showNotification } from '@/lib/redux/slices/uiSlice';
import { nav } from '@/test-utils/navigation';
import { makeStore, renderWithStore } from '@/test-utils/store';
import { render } from '@testing-library/react';

const chat = chatApi as jest.Mocked<typeof chatApi>;
const feedback = feedbackApi as jest.Mocked<typeof feedbackApi>;
const fail = (message: string) =>
  Object.assign(new Error('x'), {
    response: { data: { detail: { message } } },
  });

beforeEach(() => {
  nav.reset();
  jest.resetAllMocks();
});

describe('StatusModal', () => {
  it.each(['info', 'error', 'warning', 'success'] as const)(
    'renders a %s message',
    async (type) => {
      const onConfirm = jest.fn();
      render(
        <StatusModal
          title="Heads up"
          message="Saved"
          type={type}
          onConfirm={onConfirm}
          buttonText="OK"
        />
      );
      expect(
        screen.getByRole('heading', { name: 'Heads up' })
      ).toBeInTheDocument();
      expect(screen.getByText('Saved')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'OK' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    }
  );

  it('defaults to an info dialog with a Close button', () => {
    render(<StatusModal title="T" message="M" onConfirm={() => {}} />);
    expect(screen.getByRole('button', { name: 'Close' }).className).toContain(
      'bg-blue-600'
    );
  });
});

describe('NotificationManager', () => {
  afterEach(() => jest.useRealTimers());

  it('renders nothing without notifications', () => {
    const { container } = renderWithStore(<NotificationManager />);
    expect(container).toBeEmptyDOMElement();
  });

  it('auto-hides timed notifications and lets the user dismiss others', async () => {
    jest.useFakeTimers();
    const store = makeStore();
    renderWithStore(<NotificationManager />, { store });
    act(() => {
      store.dispatch(
        showNotification({ type: 'success', message: 'Saved', duration: 3000 })
      );
      store.dispatch(showNotification({ type: 'warning', message: 'Sticky' }));
      store.dispatch(
        showNotification({ type: 'error', message: 'Broke', duration: 5000 })
      );
      store.dispatch(showNotification({ type: 'info', message: 'FYI' }));
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(3000));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(screen.getByText('Broke')).toBeInTheDocument();

    // Dismissing early cancels the pending timer.
    const dismiss = screen
      .getByText('Broke')
      .closest('div')!
      .parentElement!.querySelector('button')!;
    act(() => dismiss.click());
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByText('Sticky')).toBeInTheDocument();
    expect(screen.getByText('FYI')).toBeInTheDocument();
    expect(store.getState().ui.notifications.map((n) => n.message)).toEqual([
      'Sticky',
      'FYI',
    ]);
  });
});

describe('FeedbackForm', () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByPlaceholderText('Your Name'), 'Ama');
    await user.type(screen.getByPlaceholderText('you@email.com'), 'ama@x.lk');
    await user.type(
      screen.getByPlaceholderText('Tell us everything...'),
      'Great app'
    );
  };

  it('submits the chosen category and thanks the user', async () => {
    const user = userEvent.setup();
    feedback.submitFeedback.mockResolvedValue({ id: '1' } as any);
    renderWithStore(<FeedbackForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'bug' }));
    await user.type(
      screen.getByPlaceholderText('What is this about?'),
      'Login'
    );
    await user.click(screen.getByRole('button', { name: /SUBMIT FEEDBACK/ }));

    expect(feedback.submitFeedback).toHaveBeenCalledWith({
      name: 'Ama',
      email: 'ama@x.lk',
      category: 'bug',
      subject: 'Login',
      message: 'Great app',
    });
    expect(
      await screen.findByRole('heading', { name: 'Thank You!' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send Another' }));
    expect(screen.getByPlaceholderText('Tell us everything...')).toHaveValue(
      ''
    );
    expect(screen.getByPlaceholderText('Your Name')).toHaveValue('Ama');
  });

  it("prefills the signed-in user's address", () => {
    renderWithStore(<FeedbackForm />, {
      store: makeStore({
        auth: { isAuthenticated: true, user: { email: 'kamal@x.lk' } as any },
      }),
    });
    expect(screen.getByPlaceholderText('you@email.com')).toHaveValue(
      'kamal@x.lk'
    );
    expect(screen.getByPlaceholderText('Your Name')).toHaveValue('kamal');
  });

  it('disables the button while sending', async () => {
    const user = userEvent.setup();
    feedback.submitFeedback.mockReturnValue(new Promise(() => {}));
    renderWithStore(<FeedbackForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /SUBMIT FEEDBACK/ }));
    expect(screen.getByRole('button', { name: 'SENDING...' })).toBeDisabled();
  });

  it('shows the server error', () => {
    renderWithStore(<FeedbackForm />, {
      store: makeStore({ feedback: { error: 'Invalid email' } }),
    });
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  // BUG: the form offers "praise", but admin_service's FeedbackCreate only
  // accepts suggestion / bug / other, so a praise submission fails with 422.
  test.failing('only offers categories the backend accepts', () => {
    renderWithStore(<FeedbackForm />);
    const offered = ['suggestion', 'bug', 'praise', 'other'].filter((c) =>
      screen.queryByRole('button', { name: c })
    );
    expect(offered).toEqual(['suggestion', 'bug', 'other']);
  });
});

describe('ChatWidget', () => {
  const message = (id: string, extra = {}) => ({
    id,
    conversation_id: '1',
    message: `msg ${id}`,
    is_from_admin: false,
    is_read: false,
    created_at: '2026-10-25T10:00:00Z',
    ...extra,
  });

  it('is hidden on admin pages', () => {
    nav.pathname = '/admin/messages';
    const { container } = renderWithStore(<ChatWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('creates a guest session id when there is none', () => {
    const store = makeStore({ chat: { sessionId: null } });
    renderWithStore(<ChatWidget />, { store });
    expect(store.getState().chat.sessionId).toBeTruthy();
    expect(localStorage.getItem('chat_session_id')).toBe(
      store.getState().chat.sessionId
    );
  });

  it('opens, loads history, polls, and sends as a guest', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    chat.getHistory.mockResolvedValue([]);
    chat.sendMessage.mockResolvedValue(
      message('9', { message: 'Hello there' }) as any
    );
    const store = makeStore({ chat: { sessionId: 'sess-1' } });
    renderWithStore(<ChatWidget />, { store });

    await user.click(screen.getAllByRole('button')[0]);
    expect(await screen.findByText('No messages yet')).toBeInTheDocument();
    expect(chat.getHistory).toHaveBeenCalledWith('sess-1');

    await act(async () => jest.advanceTimersByTime(5000));
    expect(chat.getHistory).toHaveBeenCalledTimes(2);

    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, '   ');
    await user.type(input, '{enter}');
    expect(chat.sendMessage).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, 'Hello there{enter}');
    expect(chat.sendMessage).toHaveBeenCalledWith('Hello there', 'sess-1');
    expect(await screen.findByText('Hello there')).toBeInTheDocument();
    expect(input).toHaveValue('');
    jest.useRealTimers();
  });

  it('sends as the signed-in user without a guest session', async () => {
    chat.getHistory.mockResolvedValue([]);
    chat.sendMessage.mockResolvedValue(message('9') as any);
    const store = makeStore({
      chat: { sessionId: 'sess-1' },
      auth: { isAuthenticated: true, user: { email: 'a@x.lk' } as any },
    });
    renderWithStore(<ChatWidget />, { store });
    await userEvent.click(screen.getAllByRole('button')[0]);
    await userEvent.type(
      screen.getByPlaceholderText('Type your message...'),
      'Hi{enter}'
    );
    expect(chat.sendMessage).toHaveBeenCalledWith('Hi', undefined);
  });

  it('shows conversation bubbles and badges unread admin replies while closed', async () => {
    const store = makeStore({
      chat: { sessionId: 's', messages: [message('1')] as any },
    });
    renderWithStore(<ChatWidget />, { store });
    expect(screen.queryByText('1')).not.toBeInTheDocument();

    act(() => {
      store.dispatch({
        type: 'chat/fetchHistory/fulfilled',
        payload: [
          message('1'),
          message('2', { is_from_admin: true, message: 'We can help' }),
        ],
      });
    });
    expect(screen.getByText('1')).toBeInTheDocument();

    chat.getHistory.mockResolvedValue([
      message('1'),
      message('2', { is_from_admin: true, message: 'We can help' }),
    ] as any);
    await userEvent.click(screen.getAllByRole('button')[0]);
    expect(await screen.findByText('We can help')).toBeInTheDocument();
    expect(screen.getByText('msg 1')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument(); // badge cleared

    // Closing again via the header button.
    await userEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() =>
      expect(screen.queryByText('Edura Chat')).not.toBeInTheDocument()
    );
  });

  it('caps the unread badge at 9+', () => {
    const store = makeStore({ chat: { sessionId: 's' } });
    renderWithStore(<ChatWidget />, { store });
    for (let i = 0; i < 10; i++) {
      act(() => {
        store.dispatch({
          type: 'chat/fetchHistory/fulfilled',
          payload: [message(String(i), { is_from_admin: true })],
        });
      });
    }
    expect(screen.getByText('9+')).toBeInTheDocument();
  });
});
