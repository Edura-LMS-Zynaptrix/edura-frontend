import axios from 'axios'

// API Base URL from environment variable (Edura Nginx gateway, e.g. http://localhost)
const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  console.warn('NEXT_PUBLIC_API_URL is not set. API requests may fail.')
}

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Helper: read token from storage (sessionStorage beats localStorage) ──────
function getStoredToken(key: string): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(key) || localStorage.getItem(key) || null
}

function getStorageBackend(): Storage | null {
  if (typeof window === 'undefined') return null

  // If accessToken is in sessionStorage, we are in a non-persistent session
  if (sessionStorage.getItem('accessToken')) {
    return sessionStorage
  }

  // If it's in localStorage, the user chose "Remember Me"
  if (localStorage.getItem('accessToken')) {
    return localStorage
  }

  return null
}

function clearAuthTokens() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('accessToken')
  localStorage.removeItem('accessToken')
}

// ── Request interceptor: attach current access token ───────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredToken('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Track an in-flight refresh so concurrent 401s share one refresh call
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  // Edura's auth_service issues the refresh token as an HttpOnly cookie
  // (never exposed to JS), so the browser must send it automatically via
  // withCredentials rather than us reading it from storage.
  const response = await axios.post(
    `${API_URL}/api/auth/refresh`,
    {},
    { withCredentials: true }
  )

  const newAccessToken: string = response.data.access_token

  const storage = getStorageBackend() ?? sessionStorage
  storage.setItem('accessToken', newAccessToken)

  return newAccessToken
}

// ── Response interceptor: silent token refresh on 401 ──────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const requestUrl: string = originalRequest?.url ?? ''

    // Don't attempt refresh for auth routes themselves
    const isAuthRoute =
      requestUrl.includes('/api/auth/login') ||
      requestUrl.includes('/api/auth/register') ||
      requestUrl.includes('/api/auth/refresh')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true

      try {
        // Share one refresh across concurrent requests
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null
          })
        }

        const newToken = await refreshPromise
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest) // replay the original request
      } catch {
        // Refresh failed — clear everything and redirect to login
        clearAuthTokens()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
