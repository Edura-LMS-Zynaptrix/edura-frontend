/**
 * ongoingExam.ts
 * Lightweight localStorage helper to track an in-progress exam attempt.
 *
 * Why localStorage?
 *  - Persists across page navigations inside the app.
 *  - No extra API calls needed on listing pages.
 *  - Automatically ignored once the exam is submitted or time has expired.
 */

const KEY_PREFIX = 'edura_ongoing_'

export interface OngoingExamEntry {
  examId: string
  attemptId: string
  endsAt: string       // ISO string — server canonical end time
  examTitle: string
  durationMinutes: number
  totalQuestions: number
}

/** Save an ongoing attempt record. */
export function saveOngoingExam(entry: OngoingExamEntry): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY_PREFIX + entry.examId, JSON.stringify(entry))
}

/** Get a saved ongoing attempt for a given examId, or null if expired/not found. */
export function getOngoingExam(examId: string): OngoingExamEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY_PREFIX + examId)
    if (!raw) return null
    const entry: OngoingExamEntry = JSON.parse(raw)
    // Treat as expired if endsAt is in the past
    if (new Date(entry.endsAt).getTime() < Date.now()) {
      clearOngoingExam(examId)
      return null
    }
    return entry
  } catch {
    return null
  }
}

/** Check if any exam is currently ongoing (for listing pages). */
export function getAllOngoingExams(): OngoingExamEntry[] {
  if (typeof window === 'undefined') return []
  const results: OngoingExamEntry[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(KEY_PREFIX)) {
      const examId = key.slice(KEY_PREFIX.length)
      const entry = getOngoingExam(examId)
      if (entry) results.push(entry)
    }
  }
  return results
}

/** Remove the ongoing record (call on submit or time expiry). */
export function clearOngoingExam(examId: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY_PREFIX + examId)
}

/** Returns seconds remaining for an ongoing exam, or 0 if expired. */
export function getSecondsRemaining(entry: OngoingExamEntry): number {
  return Math.max(0, Math.floor((new Date(entry.endsAt).getTime() - Date.now()) / 1000))
}
