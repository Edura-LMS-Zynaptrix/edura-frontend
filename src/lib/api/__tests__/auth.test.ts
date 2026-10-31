jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock());

import api from '@/lib/api/client';
import * as auth from '@/lib/api/auth';
import { googleLogin } from '@/lib/api/googleAuth';
import { fakeJwt, httpError, reply, type MockClient } from '@/test-utils/api';

const http = api as unknown as MockClient;

const signIn = (sub = 7, role = 'STUDENT', storage: Storage = localStorage) =>
  storage.setItem('accessToken', fakeJwt({ sub: String(sub), role }));

const profile = (
  overrides: Partial<auth.UserProfile> = {}
): auth.UserProfile => ({
  id: 7,
  name: 'Ama Perera',
  email: 'ama@example.com',
  role: 'student',
  first_name: 'Ama',
  last_name: 'Perera',
  grade: 11,
  school: 'Royal',
  district: 'Colombo',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => jest.resetAllMocks());

describe('login / register / google', () => {
  it('logs in with only email and password; the refresh token stays a cookie', async () => {
    http.post.mockReturnValue(
      reply({
        access_token: 'jwt',
        token_type: 'Bearer',
        refresh_token: 'leaked?',
      })
    );
    const res = await auth.login({
      email: 'a@x.lk',
      password: 'pw',
      remember_me: true,
    });
    expect(http.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'a@x.lk',
      password: 'pw',
    });
    expect(res).toEqual({
      access_token: 'jwt',
      token_type: 'Bearer',
      refresh_token: '',
    });
  });

  it('registers as a student by default and sends the sign-up profile', async () => {
    http.post.mockReturnValue(reply({ id: 1 }));
    const p = { first_name: 'Ama', grade: 10 };
    await auth.register({
      email: 'a@x.lk',
      password: 'pw',
      confirm_password: 'pw',
      profile: p,
    });
    expect(http.post).toHaveBeenCalledWith('/api/auth/register', {
      email: 'a@x.lk',
      password: 'pw',
      role: 'student',
      profile: p,
    });
  });

  it('keeps an explicit role', async () => {
    http.post.mockReturnValue(reply({}));
    await auth.register({ email: 'a@x.lk', password: 'pw', role: 'teacher' });
    expect(http.post.mock.calls[0][1].role).toBe('teacher');
  });

  it('exchanges a Google access token', async () => {
    http.post.mockReturnValue(
      reply({ access_token: 'jwt', token_type: 'Bearer' })
    );
    expect(await googleLogin('g-token')).toEqual({
      access_token: 'jwt',
      token_type: 'Bearer',
      refresh_token: '',
    });
    expect(http.post).toHaveBeenCalledWith('/api/auth/google', {
      access_token: 'g-token',
    });
  });
});

describe('email verification and passwords', () => {
  it.each([
    [
      'verifyEmail',
      () => auth.verifyEmail('tok'),
      '/api/auth/verify-email',
      { token: 'tok' },
    ],
    [
      'resendVerification',
      () => auth.resendVerification('a@x.lk'),
      '/api/auth/resend-verification',
      { email: 'a@x.lk' },
    ],
    [
      'forgotPassword trims the address',
      () => auth.forgotPassword({ email: '  a@x.lk  ' }),
      '/api/auth/forgot-password',
      { email: 'a@x.lk' },
    ],
    [
      'resetPassword',
      () =>
        auth.resetPassword({
          token: 't',
          new_password: 'A',
          confirm_password: 'A',
        }),
      '/api/auth/reset-password',
      { token: 't', new_password: 'A', confirm_password: 'A' },
    ],
    [
      'setPassword sends only the new password',
      () => auth.setPassword({ new_password: 'N', confirm_password: 'N' }),
      '/api/auth/set-password',
      { new_password: 'N' },
    ],
    [
      'changePassword',
      () => auth.changePassword({ current_password: 'O', new_password: 'N' }),
      '/api/auth/change-password',
      { current_password: 'O', new_password: 'N' },
    ],
  ])('%s', async (_name, call, url, body) => {
    http.post.mockReturnValue(reply({ message: 'ok' }));
    expect(await call()).toEqual({ message: 'ok' });
    expect(http.post).toHaveBeenCalledWith(url, body);
  });

  it('logs out with credentials so the refresh cookie is revoked', async () => {
    http.post.mockReturnValue(reply({}));
    await auth.logoutSession();
    expect(http.post).toHaveBeenCalledWith('/api/auth/logout', null, {
      withCredentials: true,
    });
  });
});

describe('getCurrentUser', () => {
  it('needs a stored token', async () => {
    await expect(auth.getCurrentUser()).rejects.toThrow('No active session');
    localStorage.setItem('accessToken', 'not-a-jwt');
    await expect(auth.getCurrentUser()).rejects.toThrow('No active session');
    expect(http.get).not.toHaveBeenCalled();
  });

  it('combines the token, the profile and /me', async () => {
    signIn(7, 'STUDENT', sessionStorage);
    http.get.mockImplementation((url: string) =>
      url === '/api/auth/me'
        ? reply({
            email: 'me@x.lk',
            is_active: true,
            auth_provider: 'google',
            has_password: false,
          })
        : reply(profile())
    );

    const user = await auth.getCurrentUser();

    expect(http.get).toHaveBeenCalledWith('/api/users/7');
    expect(user).toEqual({
      id: '7',
      email: 'ama@example.com', // the profile's address wins
      role: 'student',
      is_active: true,
      needs_profile_completion: false,
      full_name: 'Ama Perera',
      auth_provider: 'google',
      has_password: false,
      profile: profile(),
    });
  });

  it('retries a missing profile while user_service builds it', async () => {
    jest.useFakeTimers();
    signIn(7);
    let profileCalls = 0;
    http.get.mockImplementation((url: string) => {
      if (url === '/api/auth/me')
        return reply({ email: 'me@x.lk', is_active: true });
      profileCalls += 1;
      return profileCalls < 3 ? httpError(404) : reply(profile());
    });

    const pending = auth.getCurrentUser();
    await jest.advanceTimersByTimeAsync(2000);
    const user = await pending;

    expect(profileCalls).toBe(3);
    expect(user.profile).not.toBeNull();
    jest.useRealTimers();
  });

  it('gives up after five tries and asks for profile completion', async () => {
    jest.useFakeTimers();
    signIn(7, 'ADMIN');
    http.get.mockImplementation((url: string) =>
      url === '/api/auth/me'
        ? reply({ email: 'me@x.lk', is_active: false })
        : httpError(404)
    );

    const pending = auth.getCurrentUser();
    await jest.advanceTimersByTimeAsync(5000);
    const user = await pending;

    expect(
      http.get.mock.calls.filter(([u]) => u === '/api/users/7')
    ).toHaveLength(5);
    expect(user).toMatchObject({
      role: 'admin', // from the token when there is no profile
      email: 'me@x.lk',
      is_active: false,
      needs_profile_completion: true,
      full_name: undefined,
      profile: null,
    });
    jest.useRealTimers();
  });

  it('does not retry other profile errors and tolerates /me failing', async () => {
    signIn(7);
    http.get.mockImplementation(() => httpError(500));
    const user = await auth.getCurrentUser();
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(user).toMatchObject({ email: '', is_active: true, profile: null });
  });

  it.each([
    [{ grade: null }, true],
    [{ school: '' }, true],
    [{ district: null }, true],
    [{}, false],
  ])('a student profile %o needs completion: %s', async (overrides, needs) => {
    signIn(7);
    http.get.mockImplementation((url: string) =>
      url === '/api/auth/me' ? reply({}) : reply(profile(overrides as any))
    );
    expect((await auth.getCurrentUser()).needs_profile_completion).toBe(needs);
  });

  it('never asks staff for academic details', async () => {
    signIn(5, 'TEACHER');
    http.get.mockImplementation((url: string) =>
      url === '/api/auth/me'
        ? reply({})
        : reply(
            profile({
              role: 'teacher',
              grade: null,
              school: null,
              district: null,
            })
          )
    );
    expect((await auth.getCurrentUser()).needs_profile_completion).toBe(false);
  });
});

describe('profile', () => {
  it('reads /me', async () => {
    http.get.mockReturnValue(reply({ id: 1 }));
    expect(await auth.getMe()).toEqual({ id: 1 });
    expect(http.get).toHaveBeenCalledWith('/api/auth/me');
  });

  it('creates the profile for the signed-in account', async () => {
    http.post.mockReturnValue(reply(profile()));
    await auth.createProfile({
      first_name: 'Ama',
      last_name: 'Perera',
      referral_code: 'X',
    });
    expect(http.post).toHaveBeenCalledWith('/api/users/', {
      first_name: 'Ama',
      last_name: 'Perera',
      referral_code: 'X',
    });
  });

  it('updates the profile of the user in the token', async () => {
    signIn(42);
    http.put.mockReturnValue(reply(profile({ id: 42 })));
    await auth.updateProfile({ school: 'Ananda' });
    expect(http.put).toHaveBeenCalledWith('/api/users/42', {
      school: 'Ananda',
    });
  });

  it('refuses to update without a session', async () => {
    await expect(auth.updateProfile({ school: 'x' })).rejects.toThrow(
      'No active session'
    );
  });

  it('uploads a photo then stores both its URL and public id', async () => {
    signIn(42);
    http.post.mockReturnValue(
      reply({ secure_url: 'https://cdn/a.png', public_id: 'edura/avatars/a' })
    );
    http.put.mockReturnValue(reply(profile()));
    const form = new FormData();

    await auth.updateProfilePhoto(form);

    expect(http.post).toHaveBeenCalledWith('/api/content/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    expect(http.put).toHaveBeenCalledWith('/api/users/42', {
      avatar_url: 'https://cdn/a.png',
      avatar_public_id: 'edura/avatars/a',
    });
  });
});
