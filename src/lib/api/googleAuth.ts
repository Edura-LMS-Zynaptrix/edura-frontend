import apiClient from './client'

// auth_service's /google endpoint verifies an OAuth *access token* against
// Google's userinfo endpoint (the @react-oauth/google `flow: 'implicit'`
// shape used on the login/register pages) — not a one-tap id_token.

interface GoogleLoginResponse {
  access_token: string
  refresh_token: string // always '' — issued as an HttpOnly cookie, same as email/password login
  token_type: string
}

export const googleLogin = async (accessToken: string): Promise<GoogleLoginResponse> => {
  const response = await apiClient.post('/api/auth/google', { access_token: accessToken })
  return { ...response.data, refresh_token: '' }
}
