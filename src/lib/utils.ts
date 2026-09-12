// ── Admin Error Formatting ─────────────────────────────────────────────────

/**
 * Extracts a readable error message from Axios/FastAPI error responses.
 * Handles Pydantic validation error shapes (object with msg, array of errors).
 */
export function getErrorMessage(err: any): string {
  const detail = err?.response?.data?.detail
  if (detail) {
    if (typeof detail === 'string') return detail
    if (typeof detail === 'object' && !Array.isArray(detail) && detail.msg) return detail.msg
    if (Array.isArray(detail)) {
      const messages = detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ')
      return messages || 'Validation error occurred'
    }
  }
  return 'An error occurred'
}

// ── Currency Formatting ────────────────────────────────────────────────────

/**
 * Formats a number into a human-readable LKR amount (e.g. Rs 1.2M, Rs 3.4K).
 */
export function fmtLKR(amount: number): string {
  if (amount >= 1_000_000) return `Rs ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `Rs ${(amount / 1_000).toFixed(1)}K`
  return `Rs ${amount}`
}

// ── Time Formatting ────────────────────────────────────────────────────────

/**
 * Returns a relative time string like "5m ago", "2h ago", "3d ago".
 */
export function timeAgo(isoString: string | null): string {
  if (!isoString) return ''
  const diff = Date.now() - new Date(isoString).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
