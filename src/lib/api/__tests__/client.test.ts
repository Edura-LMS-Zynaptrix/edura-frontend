/**
 * The shared axios client: attaches the stored token, and on a 401 refreshes
 * the session once (shared by concurrent requests) before replaying the call.
 */
import axios from 'axios';
import apiClient from '@/lib/api/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Handler = (config: any) => Promise<any>;

/** Route every request through `handler` instead of the network. */
function stubTransport(handler: Handler) {
  apiClient.defaults.adapter = handler as any;
}

const ok = (config: any, data: unknown = {}) =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });

const fail = (config: any, status: number) =>
  Promise.reject(
    Object.assign(new Error(`Request failed with status code ${status}`), {
      config,
      response: { status, data: {}, headers: {}, config },
      isAxiosError: true,
    })
  );

describe('apiClient', () => {
  const originalLocation = window.location;
  let refresh: jest.SpyInstance;

  beforeEach(() => {
    refresh = jest.spyOn(axios, 'post');
    // jsdom can't navigate; record where the app sends the user instead.
    delete (window as any).location;
    (window as any).location = { href: '/dashboard' };
  });

  afterEach(() => {
    refresh.mockRestore();
    (window as any).location = originalLocation;
  });

  it('sends JSON to the gateway', () => {
    expect(apiClient.defaults.baseURL).toBe(API_URL);
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('attaches the session token, preferring sessionStorage', async () => {
    const seen: (string | undefined)[] = [];
    stubTransport((config) => {
      seen.push(config.headers.Authorization);
      return ok(config);
    });

    await apiClient.get('/a');
    localStorage.setItem('accessToken', 'remembered');
    await apiClient.get('/b');
    sessionStorage.setItem('accessToken', 'this-tab');
    await apiClient.get('/c');

    expect(seen).toEqual([undefined, 'Bearer remembered', 'Bearer this-tab']);
  });

  it('refreshes once on 401 and replays the request with the new token', async () => {
    localStorage.setItem('accessToken', 'expired');
    refresh.mockResolvedValue({ data: { access_token: 'fresh' } });
    const calls: string[] = [];
    stubTransport((config) => {
      calls.push(config.headers.Authorization);
      return config.headers.Authorization === 'Bearer fresh'
        ? ok(config, { ok: true })
        : fail(config, 401);
    });

    const res = await apiClient.get('/api/users/me');

    expect(res.data).toEqual({ ok: true });
    expect(calls).toEqual(['Bearer expired', 'Bearer fresh']);
    expect(refresh).toHaveBeenCalledWith(
      `${API_URL}/api/auth/refresh`,
      {},
      { withCredentials: true }
    );
    // "Remember me" sessions keep the token in localStorage.
    expect(localStorage.getItem('accessToken')).toBe('fresh');
    expect(sessionStorage.getItem('accessToken')).toBeNull();
  });

  it('stores a refreshed token where the session lives', async () => {
    sessionStorage.setItem('accessToken', 'expired');
    refresh.mockResolvedValue({ data: { access_token: 'fresh' } });
    stubTransport((config) =>
      config.headers.Authorization === 'Bearer fresh'
        ? ok(config)
        : fail(config, 401)
    );

    await apiClient.get('/x');
    expect(sessionStorage.getItem('accessToken')).toBe('fresh');
  });

  it('shares one refresh between concurrent 401s', async () => {
    localStorage.setItem('accessToken', 'expired');
    let resolveRefresh!: (v: unknown) => void;
    refresh.mockReturnValue(new Promise((r) => (resolveRefresh = r)));
    stubTransport((config) =>
      config.headers.Authorization === 'Bearer fresh'
        ? ok(config)
        : fail(config, 401)
    );

    const both = Promise.all([apiClient.get('/a'), apiClient.get('/b')]);
    await new Promise((r) => setTimeout(r, 0));
    resolveRefresh({ data: { access_token: 'fresh' } });
    await both;

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('signs out and goes to /login when the refresh fails', async () => {
    localStorage.setItem('accessToken', 'expired');
    sessionStorage.setItem('accessToken', 'expired');
    refresh.mockRejectedValue(new Error('refresh expired'));
    stubTransport((config) => fail(config, 401));

    await expect(apiClient.get('/x')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('never refreshes for anonymous visitors', async () => {
    stubTransport((config) => fail(config, 401));
    await expect(
      apiClient.get('/api/analytics/me/progress')
    ).rejects.toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/dashboard');
  });

  it.each(['/api/auth/login', '/api/auth/register', '/api/auth/refresh'])(
    'never refreshes for the auth route %s',
    async (url) => {
      localStorage.setItem('accessToken', 'expired');
      stubTransport((config) => fail(config, 401));
      await expect(apiClient.post(url, {})).rejects.toBeTruthy();
      expect(refresh).not.toHaveBeenCalled();
    }
  );

  it('passes other errors straight through', async () => {
    localStorage.setItem('accessToken', 'valid');
    stubTransport((config) => fail(config, 403));
    await expect(apiClient.get('/x')).rejects.toMatchObject({
      response: { status: 403 },
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not retry a request that already failed after a refresh', async () => {
    localStorage.setItem('accessToken', 'expired');
    refresh.mockResolvedValue({ data: { access_token: 'still-bad' } });
    let count = 0;
    stubTransport((config) => {
      count += 1;
      return fail(config, 401);
    });
    await expect(apiClient.get('/x')).rejects.toBeTruthy();
    expect(count).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
