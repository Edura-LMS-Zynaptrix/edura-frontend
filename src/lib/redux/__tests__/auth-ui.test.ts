jest.mock('@/lib/api/auth')
jest.mock('@/lib/api/googleAuth')

import * as authApi from '@/lib/api/auth'
import { googleLogin } from '@/lib/api/googleAuth'
import * as auth from '@/lib/redux/slices/authSlice'
import uiReducer, {
  clearNotifications,
  hideNotification,
  setLoading,
  showNotification,
} from '@/lib/redux/slices/uiSlice'
import { makeStore } from '@/test-utils/store'

const api = authApi as jest.Mocked<typeof authApi>
const tokens = { access_token: 'jwt', refresh_token: '', token_type: 'Bearer' }
const apiError = (detail: unknown) =>
  Object.assign(new Error('Request failed'), { response: { status: 400, data: { detail } } })

const user = (overrides: Record<string, unknown> = {}) => ({
  id: '7',
  email: 'ama@x.lk',
  role: 'student',
  is_active: true,
  needs_profile_completion: false,
  full_name: 'Ama Perera',
  profile: { name: 'Ama Perera', grade: 11 },
  ...overrides,
})

beforeEach(() => jest.resetAllMocks())

describe('ui slice', () => {
  it('queues notifications with unique ids, even in the same millisecond', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000)
    let state = uiReducer(undefined, showNotification({ type: 'info', message: 'a' }))
    state = uiReducer(state, showNotification({ type: 'error', message: 'b', duration: 5 }))
    const [a, b] = state.notifications
    expect(a.id).not.toBe(b.id)
    expect(b).toMatchObject({ type: 'error', message: 'b', duration: 5 })

    state = uiReducer(state, hideNotification(a.id))
    expect(state.notifications.map((n) => n.message)).toEqual(['b'])
    expect(uiReducer(state, clearNotifications()).notifications).toEqual([])
    jest.restoreAllMocks()
  })

  it('tracks a global loading message', () => {
    let state = uiReducer(undefined, setLoading({ isLoading: true, message: 'Saving…' }))
    expect(state).toMatchObject({ isLoading: true, loadingMessage: 'Saving…' })
    state = uiReducer(state, setLoading({ isLoading: false }))
    expect(state).toMatchObject({ isLoading: false, loadingMessage: null })
  })
})

describe('error-handling middleware', () => {
  const messages = (store: ReturnType<typeof makeStore>) =>
    store.getState().ui.notifications.map((n) => [n.type, n.message])

  it.each([
    ['a string payload', 'Email exists', 'Email exists'],
    ['a detail object', { detail: 'Bad request' }, 'Bad request'],
    ['a message object', { message: 'Locked' }, 'Locked'],
    ['an object with neither', { code: 1 }, 'An error occurred'],
    ['no payload', undefined, 'An error occurred'],
    ['a non-string detail', { detail: { error: 'X' } }, 'An error occurred'],
  ])('shows an error toast for %s', (_n, payload, expected) => {
    const store = makeStore()
    store.dispatch({ type: 'anything/rejected', payload })
    expect(messages(store)).toEqual([['error', expected]])
  })

  it('stays quiet for an exam that was already attempted', () => {
    const store = makeStore()
    store.dispatch({ type: 'exams/startExam/rejected', payload: { alreadyAttempted: true } })
    expect(messages(store)).toEqual([])
  })

  it.each([
    ['auth/login/fulfilled', 'Successfully logged in!'],
    ['auth/register/fulfilled', 'Account created successfully!'],
    ['auth/updateProfile/fulfilled', 'Profile updated successfully!'],
    ['x/submitPaperAttempt/fulfilled', 'Paper submitted successfully!'],
  ])('celebrates %s', (type, message) => {
    const store = makeStore()
    store.dispatch({ type, payload: tokens })
    expect(messages(store)).toContainEqual(['success', message])
  })

  it('ignores other successes', () => {
    const store = makeStore()
    store.dispatch({ type: 'courses/fetchCourses/fulfilled', payload: [] })
    expect(messages(store)).toEqual([])
  })
})

describe('auth slice — login', () => {
  it('keeps a remembered session in localStorage only', async () => {
    sessionStorage.setItem('accessToken', 'old')
    api.login.mockResolvedValue(tokens)
    const store = makeStore()

    await store.dispatch(auth.login({ email: 'a@x.lk', password: 'pw', remember_me: true }))

    expect(localStorage.getItem('accessToken')).toBe('jwt')
    expect(sessionStorage.getItem('accessToken')).toBeNull()
    expect(store.getState().auth).toMatchObject({
      isAuthenticated: true,
      accessToken: 'jwt',
      isLoading: false,
      error: null,
    })
  })

  it('keeps an unremembered session in this tab only', async () => {
    localStorage.setItem('accessToken', 'old')
    api.login.mockResolvedValue(tokens)
    await makeStore().dispatch(auth.login({ email: 'a@x.lk', password: 'pw' }))
    expect(sessionStorage.getItem('accessToken')).toBe('jwt')
    expect(localStorage.getItem('accessToken')).toBeNull()
  })

  it('remembers which address still needs verifying', async () => {
    api.login.mockRejectedValue(
      apiError({ error: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email' })
    )
    const store = makeStore()
    await store.dispatch(auth.login({ email: 'a@x.lk', password: 'pw' }))
    expect(store.getState().auth).toMatchObject({
      unverifiedEmail: 'a@x.lk',
      error: 'Please verify your email',
      isAuthenticated: false,
    })

    // A new attempt clears it.
    api.login.mockResolvedValue(tokens)
    await store.dispatch(auth.login({ email: 'b@x.lk', password: 'pw' }))
    expect(store.getState().auth.unverifiedEmail).toBeNull()
  })

  it('reports wrong credentials', async () => {
    api.login.mockRejectedValue(apiError({ error: 'INVALID_CREDENTIALS', message: 'Wrong' }))
    const store = makeStore()
    await store.dispatch(auth.login({ email: 'a@x.lk', password: 'x' }))
    expect(store.getState().auth).toMatchObject({ error: 'Wrong', unverifiedEmail: null })
  })
})

describe('auth slice — session', () => {
  it('loads the current user and whether the profile needs completing', async () => {
    api.getCurrentUser.mockResolvedValue(user({ needs_profile_completion: true }) as any)
    const store = makeStore()
    await store.dispatch(auth.fetchCurrentUser())
    expect(store.getState().auth).toMatchObject({
      isAuthenticated: true,
      needsProfileCompletion: true,
      user: { id: '7' },
    })
  })

  it('marks the app initialized even when there is no session', async () => {
    api.getCurrentUser.mockRejectedValue(new Error('No active session'))
    const store = makeStore({ auth: { isAuthenticated: true } })
    await store.dispatch(auth.fetchCurrentUser())
    expect(store.getState().auth).toMatchObject({ isAuthenticated: false, isInitialized: true })
  })

  it('logs out everywhere', () => {
    for (const s of [localStorage, sessionStorage]) {
      s.setItem('accessToken', 'a')
      s.setItem('refreshToken', 'r')
    }
    const store = makeStore({
      auth: { user: user() as any, isAuthenticated: true, accessToken: 'a', needsProfileCompletion: true },
    })
    store.dispatch(auth.logout())
    expect(store.getState().auth).toMatchObject({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      needsProfileCompletion: false,
    })
    expect(localStorage.length + sessionStorage.length).toBe(0)
  })

  it('sets credentials, persisting only when asked', () => {
    const store = makeStore()
    store.dispatch(auth.setCredentials({ accessToken: 'a', refreshToken: 'r' }))
    expect(localStorage.getItem('accessToken')).toBeNull()
    store.dispatch(auth.setCredentials({ accessToken: 'b', refreshToken: 'r', persist: true }))
    expect(localStorage.getItem('accessToken')).toBe('b')
    expect(store.getState().auth.accessToken).toBe('b')
  })

  it('has small flags for startup and profile completion', () => {
    const store = makeStore({ auth: { needsProfileCompletion: true } })
    store.dispatch(auth.setAuthenticatedFromStorage())
    expect(store.getState().auth).toMatchObject({ isAuthenticated: true, isInitialized: true })
    store.dispatch(auth.clearNeedsProfileCompletion())
    store.dispatch(auth.setUnverifiedEmail('x@y.lk'))
    expect(store.getState().auth).toMatchObject({ needsProfileCompletion: false, unverifiedEmail: 'x@y.lk' })
    const fresh = makeStore()
    fresh.dispatch(auth.setInitialized())
    expect(fresh.getState().auth.isInitialized).toBe(true)
  })
})

describe('auth slice — Google sign-in', () => {
  it('stores the session in this tab and loads the user', async () => {
    ;(googleLogin as jest.Mock).mockResolvedValue(tokens)
    api.getCurrentUser.mockResolvedValue(user({ needs_profile_completion: true }) as any)
    const store = makeStore()

    await store.dispatch(auth.googleLoginThunk('g-token'))

    expect(googleLogin).toHaveBeenCalledWith('g-token')
    expect(sessionStorage.getItem('accessToken')).toBe('jwt')
    expect(store.getState().auth).toMatchObject({
      isAuthenticated: true,
      needsProfileCompletion: true,
      user: { id: '7' },
    })
  })

  it('reports a rejected Google token', async () => {
    ;(googleLogin as jest.Mock).mockRejectedValue(apiError({ message: 'Invalid Google token' }))
    const store = makeStore()
    await store.dispatch(auth.googleLoginThunk('bad'))
    expect(store.getState().auth).toMatchObject({ error: 'Invalid Google token', isAuthenticated: false })
  })
})

describe('auth slice — profile and passwords', () => {
  it('creating the profile clears the completion step', async () => {
    api.createProfile.mockResolvedValue({ name: 'Ama P', grade: 10 } as any)
    const store = makeStore({
      auth: { user: user({ needs_profile_completion: true }) as any, needsProfileCompletion: true },
    })
    await store.dispatch(auth.createProfile({ first_name: 'Ama', last_name: 'P' }))
    expect(store.getState().auth).toMatchObject({
      needsProfileCompletion: false,
      user: { full_name: 'Ama P', needs_profile_completion: false, profile: { grade: 10 } },
    })
  })

  it('creating a profile without a loaded user only clears the flag', async () => {
    api.createProfile.mockResolvedValue({ name: 'X' } as any)
    const store = makeStore({ auth: { needsProfileCompletion: true } })
    await store.dispatch(auth.createProfile({ first_name: 'X', last_name: 'Y' }))
    expect(store.getState().auth).toMatchObject({ needsProfileCompletion: false, user: null })
  })

  it.each([
    ['updateProfile', () => auth.updateProfile({ school: 'Ananda' }), 'updateProfile', { school: 'Ananda' }],
    ['updateProfilePhoto', () => auth.updateProfilePhoto(new FormData()), 'updateProfilePhoto', { avatar_url: 'u' }],
  ] as const)('%s merges into the profile', async (_n, thunk, apiName, result) => {
    ;(api as any)[apiName].mockResolvedValue(result)
    const store = makeStore({ auth: { user: user() as any } })
    await store.dispatch(thunk() as any)
    expect(store.getState().auth.user!.profile).toEqual({ ...user().profile, ...result })
  })

  it('updating without a loaded user changes nothing', async () => {
    api.updateProfile.mockResolvedValue({ school: 'x' } as any)
    const store = makeStore()
    await store.dispatch(auth.updateProfile({ school: 'x' }))
    expect(store.getState().auth.user).toBeNull()
  })

  it.each([
    ['register', () => auth.register({ email: 'a@x.lk' }), 'register'],
    ['changePassword', () => auth.changePassword({ current_password: 'a', new_password: 'b' }), 'changePassword'],
    ['forgotPasswordThunk', () => auth.forgotPasswordThunk('a@x.lk'), 'forgotPassword'],
    ['resetPasswordThunk', () => auth.resetPasswordThunk({ token: 't', new_password: 'a', confirm_password: 'a' }), 'resetPassword'],
    ['setPasswordThunk', () => auth.setPasswordThunk({ new_password: 'a', confirm_password: 'a' }), 'setPassword'],
    ['createProfile', () => auth.createProfile({ first_name: 'a', last_name: 'b' }), 'createProfile'],
    ['updateProfile', () => auth.updateProfile({}), 'updateProfile'],
    ['updateProfilePhoto', () => auth.updateProfilePhoto(new FormData()), 'updateProfilePhoto'],
  ] as const)('%s toggles loading and records failures', async (_n, thunk, apiName) => {
    ;(api as any)[apiName].mockResolvedValue({ message: 'ok' })
    const store = makeStore({ auth: { error: 'old' } })
    const pending = store.dispatch(thunk() as any)
    expect(store.getState().auth).toMatchObject({ isLoading: true, error: null })
    await pending
    expect(store.getState().auth.isLoading).toBe(false)

    ;(api as any)[apiName].mockRejectedValue(apiError({ message: 'Nope' }))
    await store.dispatch(thunk() as any)
    expect(store.getState().auth).toMatchObject({ isLoading: false, error: 'Nope' })
  })

  it('forgot-password sends the address it was given', async () => {
    api.forgotPassword.mockResolvedValue({ message: 'ok' })
    await makeStore().dispatch(auth.forgotPasswordThunk('a@x.lk'))
    expect(api.forgotPassword).toHaveBeenCalledWith({ email: 'a@x.lk' })
  })
})
