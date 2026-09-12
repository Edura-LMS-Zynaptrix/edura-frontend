'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser, setCredentials, setAuthenticatedFromStorage, setInitialized } from '@/lib/redux/slices/authSlice'
import { syncChatThunk, fetchChatHistoryThunk } from '@/lib/redux/slices/chatSlice'

// Attempt a silent token refresh returning the new access token or null.
// Edura's refresh token is an HttpOnly cookie (never exposed to JS), so the
// browser sends it automatically via credentials: 'include' rather than us
// passing one in the body.
async function trySilentRefresh(): Promise<string | null> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.access_token ?? null
  } catch {
    return null
  }
}

// Decode JWT expiry without verifying signature (client-side only)
function getTokenExpirySeconds(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

export default function AuthInitializer() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const pathname = usePathname()
  const { accessToken, user, needsProfileCompletion, isInitialized } = useAppSelector((state) => state.auth)
  const initialized = useRef(false)

  // 1. Initial hydration from storage
  useEffect(() => {
    if (typeof window === 'undefined' || initialized.current) return
    initialized.current = true

    const run = async () => {
      // Read the access token from storage (sessionStorage takes priority).
      // Edura never hands the refresh token to JS (HttpOnly cookie), so
      // presence of an access token is the only signal we have here.
      let storedAccess = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken')
      const isPersistent = !!localStorage.getItem('accessToken')

      if (!storedAccess) {
        dispatch(setInitialized())  // Not logged in — allow route guards to fire
        return
      }

      // Check if access token is expired or expiring soon (within 10 minutes)
      const expiry = getTokenExpirySeconds(storedAccess)
      const nowSeconds = Math.floor(Date.now() / 1000)
      const isExpiredOrSoon = expiry !== null && expiry - nowSeconds < 600

      if (isExpiredOrSoon) {
        // Silently refresh before doing anything else
        const newToken = await trySilentRefresh()
        if (!newToken) {
          // Refresh failed — clear storage and bail out (user must re-login)
          sessionStorage.removeItem('accessToken')
          localStorage.removeItem('accessToken')
          dispatch(setInitialized())  // Allow route guards to redirect to login
          return
        }
        storedAccess = newToken
        const storage = isPersistent ? localStorage : sessionStorage
        storage.setItem('accessToken', newToken)
      }

      // Immediately mark as authenticated — eliminates reload flash
      dispatch(setCredentials({ accessToken: storedAccess, refreshToken: '', persist: isPersistent }))
      dispatch(setAuthenticatedFromStorage())

      // Fetch full user profile in the background (non-blocking for initial render)
      dispatch(fetchCurrentUser())

      // Sync chat session if a guest session exists
      const sessionId = localStorage.getItem('chat_session_id')
      if (sessionId) {
        try {
          await dispatch(syncChatThunk(sessionId)).unwrap()
          // After successful sync, refetch history to show merged messages immediately
          dispatch(fetchChatHistoryThunk()) 
        } catch (err) {
          console.error("Chat sync failed:", err)
        }
      }
    }

    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. Global Profile Completion Guard
  useEffect(() => {
    if (!isInitialized || !accessToken) return
    
    // Check if profile completion is needed
    const mustCompleteProfile = needsProfileCompletion || (user && user.needs_profile_completion)
    
    if (mustCompleteProfile) {
      // If user is trying to access any student route, redirect to complete-profile
      if (pathname.startsWith('/student') && pathname !== '/auth/complete-profile') {
        router.replace('/auth/complete-profile')
      }
    }
  }, [accessToken, user, needsProfileCompletion, isInitialized, pathname, router])

  return null
}
