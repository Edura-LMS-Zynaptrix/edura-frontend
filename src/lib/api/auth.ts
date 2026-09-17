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
  created_at: string
}

export interface CurrentUser {
  id: string
  email: string
  role: string
  is_active: boolean
  needs_profile_completion: boolean
  full_name?: string
  profile: UserProfile | null
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

// No /me endpoint exists on auth_service — id/role come out of the access
// token itself, and the extended profile (if any) from user_service.
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

  return {
    id: decoded.sub,
    email: profile?.email || '',
    role: profile?.role || decoded.role,
    is_active: true,
    needs_profile_completion: false,
    full_name: profile ? profile.name : undefined,
    profile,
  }
}

// Creates the profile for the currently authenticated user. auth_service's
// /register only creates the login record — this is the required follow-up
// call so the account has a name before it's used anywhere else.
export const createProfile = async (
  data: Pick<UserProfile, 'first_name' | 'last_name'> &
    Partial<Pick<UserProfile, 'mobile_no' | 'date_of_birth' | 'bio' | 'avatar_url' | 'avatar_public_id'>>
): Promise<UserProfile> => {
  const response = await apiClient.post('/api/users/', data)
  return response.data
}

export const updateProfile = async (
  data: Partial<
    Pick<UserProfile, 'first_name' | 'last_name' | 'mobile_no' | 'date_of_birth' | 'bio' | 'avatar_url' | 'avatar_public_id'>
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
// has no endpoint to actually set a new password after OTP verification —
// so the forgot/reset-password flow cannot be completed end-to-end today.

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

export const setPassword = async (_data: {
  new_password: string
  confirm_password: string
}): Promise<never> => {
  throw new Error('Password reset is not supported by the Edura backend yet.')
}

export const changePassword = async (_data: {
  current_password: string
  new_password: string
}): Promise<never> => {
  throw new Error('Password change is not supported by the Edura backend yet.')
}
