import apiClient from './client'

// ── Edura auth_service + user_service contract ──────────────────────────────
// auth_service only knows { id, email, role, is_active, is_email_verified }.
// Extended profile fields (name, mobile, avatar, ...) live in user_service and
// are keyed by the same user id (the JWT "sub" claim).

export interface LoginCredentials {
  email: string
  password: string
  remember_me?: boolean
}

export interface RegisterData {
  email: string
  password: string
  confirm_password?: string
  role?: 'student' | 'teacher' | 'admin'
}

export interface TokenResponse {
  access_token: string
  refresh_token: string // always '' — Edura issues this as an HttpOnly cookie, never in the body
  token_type: string
}

export interface UserProfile {
  id: number
  name: string
  email?: string | null
  role: string
  first_name: string
  last_name: string
  mobile_no?: string | null
  date_of_birth?: string | null
  bio?: string | null
  avatar_url?: string | null
  avatar_public_id?: string | null
  school?: string | null
  district?: string | null
  grade?: number | null
  stream_id?: number | null
  nic_number?: string | null
  selected_subjects?: string[] | null
  referral_code?: string | null
  referred_by_user_id?: number | null
  created_at: string
}

export interface MeResponse {
  id: number
  email: string
  role: string
  is_active: boolean
  is_email_verified: boolean
  auth_provider: 'email' | 'google'
  has_password: boolean
}

export interface CurrentUser {
  id: string
  email: string
  role: string
  is_active: boolean
  needs_profile_completion: boolean
  full_name?: string
  profile: UserProfile | null
  auth_provider?: string
  has_password?: boolean
}

function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken')
}

function decodeAccessToken(token: string): { sub: string; role: string } | null {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return { sub: String(json.sub), role: String(json.role || '').toLowerCase() }
  } catch {
    return null
  }
}

export const login = async (credentials: LoginCredentials): Promise<TokenResponse> => {
  const response = await apiClient.post('/api/auth/login', {
    email: credentials.email,
    password: credentials.password,
  })
  // Edura's refresh token is an HttpOnly cookie, never returned in the body.
  return { ...response.data, refresh_token: '' }
}

export const register = async (data: RegisterData) => {
  const response = await apiClient.post('/api/auth/register', {
    email: data.email,
    password: data.password,
    role: data.role ?? 'student',
  })
  return response.data
}

// id/role come out of the access token itself; auth_provider/has_password
// from auth_service's real /me; the extended profile (if any) from user_service.
export const getCurrentUser = async (): Promise<CurrentUser> => {
  const token = getStoredAccessToken()
  const decoded = token ? decodeAccessToken(token) : null
  if (!decoded) throw new Error('No active session')

  let profile: UserProfile | null = null
  try {
    const response = await apiClient.get(`/api/users/${decoded.sub}`)
    profile = response.data
  } catch {
    // user_service has no endpoint to create a profile on registration, so a
    // freshly-registered user legitimately has none yet — not fatal.
    profile = null
  }

  let me: MeResponse | null = null
  try {
    me = await getMe()
  } catch {
    me = null
  }

  return {
    id: decoded.sub,
    email: profile?.email || me?.email || '',
    role: profile?.role || decoded.role,
    is_active: me?.is_active ?? true,
    // A missing profile (404, tolerated above) means this account — email or
    // Google — has never finished registration; the caller should route to
    // the profile-completion step.
    needs_profile_completion: profile === null,
    full_name: profile ? profile.name : undefined,
    auth_provider: me?.auth_provider,
    has_password: me?.has_password,
    profile,
  }
}

// Real /me on auth_service — surfaces auth_provider/has_password so a
// profile page can offer "Set password" for Google-only accounts.
export const getMe = async (): Promise<MeResponse> => {
  const response = await apiClient.get('/api/auth/me')
  return response.data
}

// Creates the profile for the currently authenticated user. auth_service's
// /register only creates the login record — this is the required follow-up
// call so the account has a name before it's used anywhere else. Also used
// as the one-time profile-completion step for new Google sign-ups.
export const createProfile = async (
  data: Pick<UserProfile, 'first_name' | 'last_name'> &
    Partial<
      Pick<
        UserProfile,
        | 'mobile_no'
        | 'date_of_birth'
        | 'bio'
        | 'avatar_url'
        | 'avatar_public_id'
        | 'school'
        | 'district'
        | 'grade'
        | 'stream_id'
        | 'nic_number'
        | 'selected_subjects'
      >
    > & { referral_code?: string | null }
): Promise<UserProfile> => {
  const response = await apiClient.post('/api/users/', data)
  return response.data
}

export const updateProfile = async (
  data: Partial<
    Pick<
      UserProfile,
      | 'first_name'
      | 'last_name'
      | 'mobile_no'
      | 'date_of_birth'
      | 'bio'
      | 'avatar_url'
      | 'avatar_public_id'
      | 'school'
      | 'district'
      | 'grade'
      | 'stream_id'
      | 'nic_number'
      | 'selected_subjects'
    >
  >
) => {
  const token = getStoredAccessToken()
  const decoded = token ? decodeAccessToken(token) : null
  if (!decoded) throw new Error('No active session')

  const response = await apiClient.put(`/api/users/${decoded.sub}`, data)
  return response.data as UserProfile
}

// Uploads the photo to Cloudinary via content_service's self-service /avatar
// endpoint, then persists both the URL and the public_id (needed to later
// manage/delete the asset in Cloudinary — a URL alone isn't enough for that).
export const updateProfilePhoto = async (data: FormData): Promise<UserProfile> => {
  const uploadResponse = await apiClient.post('/api/content/avatar', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return updateProfile({
    avatar_url: uploadResponse.data.secure_url,
    avatar_public_id: uploadResponse.data.public_id,
  })
}

// ── Password management ──────────────────────────────────────────────────
// auth_service exposes OTP request/verify keyed by user_id (not email), and
// has no endpoint to turn a verified OTP into a new password — so the
// email-link forgot/reset-password flow still cannot be completed end-to-end.
// set-password / change-password (both authenticated, JWT-scoped) are real.

export const forgotPassword = async (_data: { email: string }): Promise<never> => {
  throw new Error('Password reset is not supported by the Edura backend yet.')
}

export const resetPassword = async (_data: {
  token: string
  new_password: string
  confirm_password: string
}): Promise<never> => {
  throw new Error('Password reset is not supported by the Edura backend yet.')
}

// For a Google-only account (no password yet) — after this, the same email
// works with both Google Sign-In and email+password.
export const setPassword = async (data: {
  new_password: string
  confirm_password: string
}): Promise<{ message: string }> => {
  const response = await apiClient.post('/api/auth/set-password', { new_password: data.new_password })
  return response.data
}

export const changePassword = async (data: {
  current_password: string
  new_password: string
}): Promise<{ message: string }> => {
  const response = await apiClient.post('/api/auth/change-password', data)
  return response.data
}
