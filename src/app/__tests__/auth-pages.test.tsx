jest.mock(
  'next/navigation',
  () => require('@/test-utils/navigation').navigationMock
);
jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/googleAuth');

const google = { options: null as any };
jest.mock('@react-oauth/google', () => ({
  useGoogleLogin: (options: any) => {
    google.options = options;
    return () => options.onSuccess({ access_token: 'g-token' });
  },
}));

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '@/lib/api/auth';
import { googleLogin } from '@/lib/api/googleAuth';
import ForgotPasswordPage from '@/app/forgot-password/page';
import LoginPage from '@/app/login/page';
import ResetPasswordPage from '@/app/reset-password/page';
import VerifyEmailPage from '@/app/verify-email/page';
import { nav } from '@/test-utils/navigation';
import { makeStore, renderWithStore } from '@/test-utils/store';

const auth = authApi as jest.Mocked<typeof authApi>;
const tokens = { access_token: 'jwt', refresh_token: '', token_type: 'Bearer' };
const apiError = (detail: unknown) =>
  Object.assign(new Error('x'), {
    response: { status: 400, data: { detail } },
  });

beforeEach(() => {
  nav.reset();
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => (console.error as jest.Mock).mockRestore?.());

describe('Login page', () => {
  const signIn = async (email = 'ama@x.lk', password = 'Password@1') => {
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Enter your email'), email);
    await user.type(
      screen.getByPlaceholderText('Enter your password'),
      password
    );
    return user;
  };

  it('signs a student in and sends them to the callback URL', async () => {
    nav.setSearch({ callbackUrl: '/student/courses' });
    auth.login.mockResolvedValue(tokens);
    auth.getCurrentUser.mockResolvedValue({
      id: '7',
      role: 'student',
      needs_profile_completion: false,
    } as any);
    renderWithStore(<LoginPage />);

    const user = await signIn('  ama@x.lk  ');
    await user.click(screen.getByLabelText('Remember me'));
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() =>
      expect(nav.router.push).toHaveBeenCalledWith('/student/courses')
    );
    expect(auth.login).toHaveBeenCalledWith({
      email: 'ama@x.lk',
      password: 'Password@1',
      remember_me: true,
    });
    expect(localStorage.getItem('accessToken')).toBe('jwt');
  });

  it('sends admins to the admin dashboard', async () => {
    auth.login.mockResolvedValue(tokens);
    auth.getCurrentUser.mockResolvedValue({ id: '1', role: 'admin' } as any);
    renderWithStore(<LoginPage />);
    const user = await signIn();
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() =>
      expect(nav.router.push).toHaveBeenCalledWith('/admin/dashboard')
    );
  });

  it('shows wrong credentials', async () => {
    auth.login.mockRejectedValue(
      apiError({
        error: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      })
    );
    renderWithStore(<LoginPage />);
    const user = await signIn();
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(
      await screen.findByText('Email or password is incorrect')
    ).toBeInTheDocument();
    expect(nav.router.push).not.toHaveBeenCalled();
  });

  it('offers to resend the verification email for an unverified account', async () => {
    auth.login.mockRejectedValue(
      apiError({ error: 'EMAIL_NOT_VERIFIED', message: 'Verify first' })
    );
    auth.resendVerification.mockResolvedValue({
      message: 'A new link is on its way.',
    });
    renderWithStore(<LoginPage />);
    const user = await signIn();
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(
      await screen.findByText('Please verify your email first')
    ).toBeInTheDocument();
    expect(screen.queryByText('Verify first')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Resend verification email' })
    );
    expect(auth.resendVerification).toHaveBeenCalledWith('ama@x.lk');
    expect(
      await screen.findByText('A new link is on its way.')
    ).toBeInTheDocument();
  });

  it('explains when the verification email cannot be sent', async () => {
    auth.resendVerification.mockRejectedValue(new Error('down'));
    renderWithStore(<LoginPage />, {
      store: makeStore({ auth: { unverifiedEmail: 'a@x.lk', error: 'x' } }),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Resend verification email' })
    );
    expect(
      await screen.findByText(/could not send the email/)
    ).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    renderWithStore(<LoginPage />);
    const input = screen.getByPlaceholderText('Enter your password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(
      screen.getByRole('button', { name: 'Show password' })
    );
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(
      screen.getByRole('button', { name: 'Hide password' })
    );
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows a busy state while signing in', () => {
    renderWithStore(<LoginPage />, {
      store: makeStore({ auth: { isLoading: true } }),
    });
    expect(screen.getAllByText('Signing in...')).toHaveLength(2);
  });

  it('signs in with Google', async () => {
    (googleLogin as jest.Mock).mockResolvedValue(tokens);
    auth.getCurrentUser.mockResolvedValue({
      id: '7',
      role: 'student',
      needs_profile_completion: true,
    } as any);
    const store = makeStore();
    renderWithStore(<LoginPage />, { store });
    await userEvent.click(
      screen.getByRole('button', { name: 'Continue with Google' })
    );
    expect(googleLogin).toHaveBeenCalledWith('g-token');
    await waitFor(() =>
      expect(nav.router.push).toHaveBeenCalledWith('/auth/complete-profile')
    );
    expect(google.options.flow).toBe('implicit');
    google.options.onError();
  });

  it('logs a failed Google sign-in', async () => {
    (googleLogin as jest.Mock).mockRejectedValue(
      apiError({ message: 'Bad token' })
    );
    renderWithStore(<LoginPage />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Continue with Google' })
    );
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Google login failed:',
        'Bad token'
      )
    );
  });

  it.each([
    [
      { needsProfileCompletion: true },
      { ref: 'AMA1' },
      '/auth/complete-profile?ref=AMA1',
    ],
    [{ needsProfileCompletion: false }, {}, '/'],
    [
      { needsProfileCompletion: false, user: { role: 'admin' } },
      {},
      '/admin/dashboard',
    ],
  ])('redirects someone already signed in (%o)', (auth, query, target) => {
    nav.setSearch(query as any);
    renderWithStore(<LoginPage />, {
      store: makeStore({
        auth: {
          isAuthenticated: true,
          user: { role: 'student' } as any,
          ...(auth as any),
        },
      }),
    });
    expect(nav.router.push).toHaveBeenCalledWith(target);
  });

  // SECURITY: callbackUrl goes straight into router.push, so
  // /login?callbackUrl=https://evil.example sends the user off-site after login.
  test.failing(
    'ignores a callback URL that points to another site',
    async () => {
      nav.setSearch({ callbackUrl: 'https://evil.example/phish' });
      auth.login.mockResolvedValue(tokens);
      auth.getCurrentUser.mockResolvedValue({
        id: '7',
        role: 'student',
      } as any);
      renderWithStore(<LoginPage />);
      const user = await signIn();
      await user.click(screen.getByRole('button', { name: 'Sign In' }));
      await waitFor(() => expect(nav.router.push).toHaveBeenCalled());
      expect(nav.router.push).not.toHaveBeenCalledWith(
        'https://evil.example/phish'
      );
    }
  );
});

describe('Forgot password page', () => {
  it('sends the reset link and shows a confirmation', async () => {
    auth.forgotPassword.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup();
    renderWithStore(<ForgotPasswordPage />);
    const submit = screen.getByRole('button', { name: 'Send Reset Link' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'ama@x.lk');
    await user.click(submit);

    expect(auth.forgotPassword).toHaveBeenCalledWith({ email: 'ama@x.lk' });
    expect(
      await screen.findByRole('heading', { name: 'Check your email' })
    ).toBeInTheDocument();
    expect(screen.getByText('ama@x.lk')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'try again' }));
    expect(
      screen.getByRole('heading', { name: 'Forgot your password?' })
    ).toBeInTheDocument();
  });

  it('shows an error when the request fails', async () => {
    auth.forgotPassword.mockRejectedValue(
      apiError({ message: 'Too many requests' })
    );
    renderWithStore(<ForgotPasswordPage />);
    await userEvent.type(
      screen.getByPlaceholderText('you@example.com'),
      'a@x.lk'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Send Reset Link' })
    );
    expect(await screen.findByText('Too many requests')).toBeInTheDocument();
  });

  it('shows a busy state', () => {
    renderWithStore(<ForgotPasswordPage />, {
      store: makeStore({ auth: { isLoading: true } }),
    });
    expect(screen.getByText('Sending…')).toBeInTheDocument();
  });
});

describe('Reset password page', () => {
  const fill = async (password: string, confirm = password) => {
    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText('At least 8 characters'),
      password
    );
    await user.type(
      screen.getByPlaceholderText('Repeat your password'),
      confirm
    );
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));
  };

  it('needs a token from the email link', () => {
    renderWithStore(<ResetPasswordPage />);
    expect(
      screen.getByText(/Invalid or missing reset link/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Request a new link' })
    ).toHaveAttribute('href', '/forgot-password');
    expect(
      screen.getByRole('button', { name: 'Reset Password' })
    ).toBeDisabled();
  });

  it('checks the passwords match and are long enough', async () => {
    nav.setSearch({ token: 't' });
    renderWithStore(<ResetPasswordPage />);
    await fill('Password@1', 'Password@2');
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  it('rejects a short password before calling the server', async () => {
    nav.setSearch({ token: 't' });
    const { container } = renderWithStore(<ResetPasswordPage />);
    // Bypass the browser's minLength so the page's own check runs.
    container
      .querySelectorAll('input')
      .forEach((i) => i.removeAttribute('minlength'));
    await fill('short');
    expect(
      screen.getByText('Password must be at least 8 characters.')
    ).toBeInTheDocument();
  });

  it('resets the password and returns to login', async () => {
    jest.useFakeTimers();
    nav.setSearch({ token: 'tok', callbackUrl: '/student/my-courses' });
    auth.resetPassword.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderWithStore(<ResetPasswordPage />);
    await user.click(screen.getByRole('button', { name: '👁️' }));
    expect(
      screen.getByPlaceholderText('At least 8 characters')
    ).toHaveAttribute('type', 'text');
    await user.type(
      screen.getByPlaceholderText('At least 8 characters'),
      'Password@1'
    );
    await user.type(
      screen.getByPlaceholderText('Repeat your password'),
      'Password@1'
    );
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(auth.resetPassword).toHaveBeenCalledWith({
      token: 'tok',
      new_password: 'Password@1',
      confirm_password: 'Password@1',
    });
    expect(
      await screen.findByText(/Password reset successfully/)
    ).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(2500));
    expect(nav.router.push).toHaveBeenCalledWith(
      '/login?callbackUrl=%2Fstudent%2Fmy-courses'
    );
    jest.useRealTimers();
  });

  it('goes to plain login without a callback', async () => {
    jest.useFakeTimers();
    nav.setSearch({ token: 'tok' });
    auth.resetPassword.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderWithStore(<ResetPasswordPage />);
    await user.type(
      screen.getByPlaceholderText('At least 8 characters'),
      'Password@1'
    );
    await user.type(
      screen.getByPlaceholderText('Repeat your password'),
      'Password@1'
    );
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));
    await screen.findByText(/Password reset successfully/);
    act(() => jest.advanceTimersByTime(2500));
    expect(nav.router.push).toHaveBeenCalledWith('/login');
    jest.useRealTimers();
  });

  it('shows an expired-link error from the server', async () => {
    nav.setSearch({ token: 'old' });
    auth.resetPassword.mockRejectedValue(
      apiError({ message: 'Invalid or expired reset link.' })
    );
    renderWithStore(<ResetPasswordPage />);
    await fill('Password@1');
    expect(
      await screen.findByText('Invalid or expired reset link.')
    ).toBeInTheDocument();
  });

  it('shows a busy state', () => {
    nav.setSearch({ token: 't' });
    renderWithStore(<ResetPasswordPage />, {
      store: makeStore({ auth: { isLoading: true } }),
    });
    expect(screen.getByText('Resetting…')).toBeInTheDocument();
  });
});

describe('Verify email page', () => {
  it('verifies the link from the email', async () => {
    nav.setSearch({ token: 'tok' });
    let resolve!: (v: any) => void;
    auth.verifyEmail.mockReturnValue(new Promise((r) => (resolve = r)));
    renderWithStore(<VerifyEmailPage />);
    expect(screen.getByText('Verifying your email…')).toBeInTheDocument();
    await act(async () => resolve({ message: 'ok' }));
    expect(
      screen.getByRole('heading', { name: 'Email verified' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue to login' })
    ).toHaveAttribute('href', '/login');
    expect(auth.verifyEmail).toHaveBeenCalledTimes(1);
  });

  it('explains a bad link and resends a new one', async () => {
    nav.setSearch({ token: 'bad' });
    auth.verifyEmail.mockRejectedValue(
      apiError({ message: 'This verification link is invalid or has expired.' })
    );
    auth.resendVerification.mockResolvedValue({
      message: 'If that address has an account…',
    });
    const user = userEvent.setup();
    renderWithStore(<VerifyEmailPage />);
    expect(
      await screen.findByText(
        'This verification link is invalid or has expired.'
      )
    ).toBeInTheDocument();

    const submit = screen.getByRole('button', {
      name: 'Resend verification email',
    });
    expect(submit).toBeDisabled();
    await user.type(
      screen.getByPlaceholderText('you@example.com'),
      ' ama@x.lk '
    );
    await user.click(submit);
    expect(auth.resendVerification).toHaveBeenCalledWith('ama@x.lk');
    expect(
      await screen.findByText('If that address has an account…')
    ).toBeInTheDocument();
  });

  it('handles a link without a token and a failed resend', async () => {
    auth.resendVerification.mockRejectedValue(
      apiError({ message: 'Slow down' })
    );
    renderWithStore(<VerifyEmailPage />);
    expect(screen.getByText(/missing its token/)).toBeInTheDocument();
    expect(auth.verifyEmail).not.toHaveBeenCalled();
    await userEvent.type(
      screen.getByPlaceholderText('you@example.com'),
      'a@x.lk'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Resend verification email' })
    );
    expect(await screen.findByText('Slow down')).toBeInTheDocument();
  });
});
