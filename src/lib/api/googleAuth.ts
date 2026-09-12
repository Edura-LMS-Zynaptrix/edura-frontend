// Edura's auth_service has no Google OAuth endpoint (only an unused Asgardeo
// SSO config placeholder) — these calls have nothing to reach.

interface GoogleLoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  needs_profile_completion: boolean
}

export const googleLogin = async (_idToken: string): Promise<GoogleLoginResponse> => {
  throw new Error('Google sign-in is not supported by the Edura backend yet.')
}

export const completeGoogleProfile = async (_profileData: {
  phone_number: string
  school: string
  district: string
  grade: number
  stream_id?: string | null
  selected_subjects: string[]
  referral_code?: string
}): Promise<{ message: string }> => {
  throw new Error('Google sign-in is not supported by the Edura backend yet.')
}
