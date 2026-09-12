'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAppSelector, useAppDispatch } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import {
  getStudentClassPackages,
  enrollFreeClassPackage,
  type StudentClassPackage,
} from '@/lib/api/student'
import { getErrorMessage } from '@/lib/utils'

function gradeBadge(grade: number) {
  if (grade <= 9) return { label: 'Primary', color: 'bg-blue-50 text-blue-700 border-blue-100' }
  if (grade <= 11) return { label: 'O/L', color: 'bg-purple-50 text-purple-700 border-purple-100' }
  return { label: 'A/L', color: 'bg-teal-50 text-teal-700 border-teal-100' }
}

function accessDescription(grade: number) {
  if (grade === 11) return 'Unlocks all your selected subjects for Grade 10 & 11'
  if (grade === 13) return 'Unlocks all your selected subjects for Grade 12 & 13'
  return `Unlocks all your selected subjects for Grade ${grade}`
}

export default function StudentClassPackagesPage() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const { user, isAuthenticated, isInitialized } = useAppSelector((s) => s.auth)

  const [mounted, setMounted] = useState(false)
  const [packages, setPackages] = useState<StudentClassPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isInitialized) dispatch(fetchCurrentUser())
  }, [isInitialized, dispatch])

  useEffect(() => {
    if (isInitialized && !isAuthenticated) router.push('/login')
  }, [isInitialized, isAuthenticated, router])

  useEffect(() => {
    if (!isInitialized) return
    setLoading(true)
    getStudentClassPackages()
      .then(setPackages)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [isInitialized])

  async function handleEnrollFree(pkg: StudentClassPackage) {
    setEnrollingId(pkg.id)
    setError('')
    try {
      await enrollFreeClassPackage(pkg.id)
      setSuccessId(pkg.id)
      // Refresh to update is_enrolled flags
      const updated = await getStudentClassPackages()
      setPackages(updated)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setEnrollingId(null)
    }
  }

  if (!mounted || !isInitialized || !user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Class Packages</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Enrol in a class to unlock <strong>all</strong> courses for that grade — no need to buy each course separately.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-medium">No class packages available for your grade yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {packages.map((pkg) => {
              const badge = gradeBadge(pkg.grade)
              const isEnrolled = pkg.is_enrolled
              const isFree = pkg.price === 0
              const justEnrolled = successId === pkg.id

              return (
                <div
                  key={pkg.id}
                  className={`bg-white rounded-xl border p-5 flex flex-col gap-4 ${
                    isEnrolled ? 'border-teal-200 ring-1 ring-teal-100' : 'border-gray-200'
                  }`}
                >
                  {/* Top */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-gray-400">Grade {pkg.grade}</span>
                        {pkg.stream_name && (
                          <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                            {pkg.stream_name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 leading-tight">{pkg.name}</h3>
                    </div>
                    {isEnrolled && (
                      <span className="shrink-0 text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-semibold">
                        Enrolled ✓
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-500">
                    {pkg.description ?? accessDescription(pkg.grade)}
                  </p>

                  {/* Price + CTA */}
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-lg font-extrabold text-teal-600">
                      {isFree ? 'Free' : `LKR ${pkg.price.toLocaleString()}`}
                    </span>
                    {isEnrolled ? (
                      <Link
                        href="/student/courses"
                        className="text-xs px-4 py-2 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg font-medium hover:bg-teal-100 transition"
                      >
                        View Courses →
                      </Link>
                    ) : isFree ? (
                      <button
                        onClick={() => handleEnrollFree(pkg)}
                        disabled={enrollingId === pkg.id}
                        className="text-xs px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition disabled:opacity-60"
                      >
                        {enrollingId === pkg.id ? 'Enrolling…' : justEnrolled ? 'Done!' : 'Enrol Free'}
                      </button>
                    ) : (
                      <Link
                        href={`/payment?type=class_package&id=${pkg.id}&name=${encodeURIComponent(pkg.name)}&amount=${pkg.price}`}
                        className="text-xs px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
                      >
                        Buy Now
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Already enrolled section */}
        {packages.some((p) => p.is_enrolled) && (
          <div className="mt-10 p-4 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
            <p className="font-semibold">You have active class enrollments!</p>
            <p className="mt-1 text-teal-700">
              Go to <Link href="/student/courses" className="font-semibold underline">My Courses</Link> to access all unlocked courses.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
