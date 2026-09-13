'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchAvailableCourses } from '@/lib/redux/slices/coursesSlice'
import { fetchPublicStreams } from '@/lib/redux/slices/adminSlice'
import {
  getStudentClassPackages,
  enrollFreeClassPackage,
  type StudentClassPackage,
} from '@/lib/api/student'
import { getErrorMessage } from '@/lib/utils'

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'grade-asc' | 'grade-desc'

const GRADES = [5, 6, 7, 8, 9, 10, 11, 12, 13]

const subjectColors: Record<string, string> = {
  Mathematics: 'bg-blue-100 text-blue-700',
  Science: 'bg-green-100 text-green-700',
  English: 'bg-purple-100 text-purple-700',
  History: 'bg-yellow-100 text-yellow-700',
  'Combined Mathematics': 'bg-indigo-100 text-indigo-700',
  Physics: 'bg-cyan-100 text-cyan-700',
  Chemistry: 'bg-pink-100 text-pink-700',
  Biology: 'bg-emerald-100 text-emerald-700',
  ICT: 'bg-orange-100 text-orange-700',
}
function subjectColor(s: string) {
  return subjectColors[s] ?? 'bg-teal-100 text-teal-700'
}

// ── Filter panel (reused for sidebar & mobile drawer) ──────────────────────
interface FilterPanelProps {
  subjects: string[]
  selectedGrades: number[]
  selectedSubjects: string[]
  priceFilter: 'all' | 'free' | 'paid'
  sortOption: SortOption
  onGradeToggle: (g: number) => void
  onSubjectToggle: (s: string) => void
  onPriceChange: (v: 'all' | 'free' | 'paid') => void
  onSortChange: (v: SortOption) => void
  onClear: () => void
  activeCount: number
}

function FilterPanel({
  subjects, selectedGrades, selectedSubjects, priceFilter,
  sortOption, onGradeToggle, onSubjectToggle, onPriceChange,
  onSortChange, onClear, activeCount,
}: FilterPanelProps) {
  return (
    <div className="space-y-6">
      {/* Active filter count + clear */}
      {activeCount > 0 && (
        <button
          onClick={onClear}
          className="w-full flex items-center justify-between px-3 py-2 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors"
        >
          <span>{activeCount} filter{activeCount > 1 ? 's' : ''} active</span>
          <span className="text-xs underline">Clear all</span>
        </button>
      )}

      {/* Sort */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Sort By</h3>
        <select
          value={sortOption}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="default">Default</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="grade-asc">Grade: Low to High</option>
          <option value="grade-desc">Grade: High to Low</option>
        </select>
      </div>

      {/* Price */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Price</h3>
        <div className="space-y-2">
          {([['all', 'All Courses'], ['free', 'Free Only'], ['paid', 'Paid Only']] as const).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="price"
                value={val}
                checked={priceFilter === val}
                onChange={() => onPriceChange(val)}
                className="accent-teal-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Subject */}
      {subjects.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Subject</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {subjects.map((s) => {
              const active = selectedSubjects.includes(s)
              return (
                <label key={s} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => onSubjectToggle(s)}
                    className="accent-teal-600 rounded"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-tight">{s}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function CourseList() {
  const pathname = usePathname()
  const dispatch = useAppDispatch()
  const { availableCourses: courses, studentLoading: loading, studentError: error } = useAppSelector((state) => state.courses)
  const { streams } = useAppSelector((state) => state.admin)
  const { needsProfileCompletion, isAuthenticated } = useAppSelector((state) => state.auth)

  if (needsProfileCompletion) return null

  const isVideoSection = pathname.includes('video-courses')
  const sectionTitle = isVideoSection ? 'Video Courses' : 'Exam Courses'
  // Edura doesn't split courses into "video" vs "exam" types — a course can
  // hold both lessons and assessments — so both tabs show the same catalog.

  // Filters
  const [search, setSearch] = useState('')
  const [selectedGrades, setSelectedGrades] = useState<number[]>([])
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all')
  const [sortOption, setSortOption] = useState<SortOption>('default')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Class package state
  const [classPackages, setClassPackages] = useState<StudentClassPackage[]>([])
  const [enrollingPkgId, setEnrollingPkgId] = useState<string | null>(null)
  const [pkgError, setPkgError] = useState('')

  useEffect(() => {
    dispatch(fetchAvailableCourses())
  }, [dispatch])

  useEffect(() => {
    if (streams.length === 0) {
      dispatch(fetchPublicStreams())
    }
  }, [dispatch, streams.length])

  // Fetch class packages for authenticated students
  useEffect(() => {
    if (!isAuthenticated) return
    getStudentClassPackages()
      .then(setClassPackages)
      .catch(() => {})
  }, [isAuthenticated])

  // Unique subjects derived from courses — Edura courses don't carry a
  // subject field today, so this naturally stays empty and the Subject
  // filter section (conditionally rendered) just doesn't show.
  const subjects = useMemo(
    () => [...new Set(courses.map((c) => c.subject).filter(Boolean))].sort(),
    [courses]
  )

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...courses]
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((c) => c.title.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q))
    if (selectedGrades.length) list = list.filter((c) => selectedGrades.includes(c.grade))
    if (selectedSubjects.length) list = list.filter((c) => selectedSubjects.includes(c.subject))
    if (priceFilter === 'free') list = list.filter((c) => c.price === 0)
    if (priceFilter === 'paid') list = list.filter((c) => c.price > 0)
    if (sortOption === 'price-asc') list.sort((a, b) => a.price - b.price)
    if (sortOption === 'price-desc') list.sort((a, b) => b.price - a.price)
    if (sortOption === 'grade-asc') list.sort((a, b) => a.grade - b.grade)
    if (sortOption === 'grade-desc') list.sort((a, b) => b.grade - a.grade)
    return list
  }, [courses, search, selectedGrades, selectedSubjects, priceFilter, sortOption])

  const activeCount =
    selectedGrades.length +
    selectedSubjects.length +
    (priceFilter !== 'all' ? 1 : 0) +
    (sortOption !== 'default' ? 1 : 0)

  function clearFilters() {
    setSearch('')
    setSelectedGrades([])
    setSelectedSubjects([])
    setPriceFilter('all')
    setSortOption('default')
  }

  function toggleGrade(g: number) {
    setSelectedGrades((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])
  }

  function toggleSubject(s: string) {
    setSelectedSubjects((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  const filterProps: FilterPanelProps = {
    subjects, selectedGrades, selectedSubjects, priceFilter, sortOption,
    onGradeToggle: toggleGrade, onSubjectToggle: toggleSubject,
    onPriceChange: setPriceFilter, onSortChange: setSortOption,
    onClear: clearFilters, activeCount,
  }

  async function handleEnrollFreePackage(pkg: StudentClassPackage) {
    setEnrollingPkgId(pkg.id)
    setPkgError('')
    try {
      await enrollFreeClassPackage(pkg.id)
      const updated = await getStudentClassPackages()
      setClassPackages(updated)
    } catch (e) {
      setPkgError(getErrorMessage(e))
    } finally {
      setEnrollingPkgId(null)
    }
  }

  const enrolledPkgs = classPackages.filter((p) => p.is_enrolled)
  const unenrolledPkgs = classPackages.filter((p) => !p.is_enrolled)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top bar: search + mobile filter button ── */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap hidden md:block">{sectionTitle}</h1>
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            <input
              type="text"
              placeholder="Search courses or subjects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>
        {/* Mobile filter button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 relative"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 12h10M11 20h2"/></svg>
            Filters
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-teal-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">{activeCount}</span>
            )}
          </button>
          {/* Result count */}
          {!loading && (
            <span className="hidden sm:block text-sm text-gray-500 whitespace-nowrap">
              {filtered.length} {isVideoSection ? 'course' : 'exam'}{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Mobile filter drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          {/* Panel */}
          <div className="relative ml-auto w-80 max-w-full h-full bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Filters</h2>
              <button onClick={() => setDrawerOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <FilterPanel {...filterProps} />
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors"
              >
                Show {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-8">

        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-60 shrink-0">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm sticky top-[8.5rem]">
            <h2 className="font-bold text-gray-900 mb-5">Filters</h2>
            <FilterPanel {...filterProps} />
          </div>
        </aside>

        {/* Course grid */}
        <main className="flex-1 min-w-0">

          {/* ── Class package banner ── */}
          {isAuthenticated && classPackages.length > 0 && (
            <div className="mb-5 space-y-2">
              {pkgError && (
                <div className="flex items-center justify-between px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  <span>{pkgError}</span>
                  <button onClick={() => setPkgError('')} className="ml-2 text-red-400 hover:text-red-600">✕</button>
                </div>
              )}

              {/* Enrolled packages */}
              {enrolledPkgs.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-4 h-4 text-teal-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span className="text-sm font-semibold text-teal-800 truncate">
                      Class Access Active — {pkg.name}
                    </span>
                    {pkg.stream_name && (
                      <span className="shrink-0 text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full border border-teal-200">{pkg.stream_name}</span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-teal-600 font-medium">All courses unlocked</span>
                </div>
              ))}

              {/* Unenrolled packages */}
              {unenrolledPkgs.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex-wrap gap-y-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-gray-900">{pkg.name}</span>
                      {pkg.stream_name && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">{pkg.stream_name}</span>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {pkg.grade === 11
                          ? 'Unlocks your selected subjects for Grade 10 & 11'
                          : pkg.grade === 13
                          ? 'Unlocks your selected subjects for Grade 12 & 13'
                          : `Unlocks your selected subjects for Grade ${pkg.grade}${pkg.stream_name ? ` (${pkg.stream_name})` : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base font-extrabold text-gray-900">
                      {pkg.price === 0 ? 'Free' : `LKR ${pkg.price.toLocaleString()}`}
                    </span>
                    {pkg.price === 0 ? (
                      <button
                        onClick={() => handleEnrollFreePackage(pkg)}
                        disabled={enrollingPkgId === pkg.id}
                        className="px-4 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition disabled:opacity-60"
                      >
                        {enrollingPkgId === pkg.id ? 'Enrolling…' : 'Enrol Free'}
                      </button>
                    ) : (
                      <Link
                        href={`/payment?type=class_package&id=${pkg.id}&name=${encodeURIComponent(pkg.name)}&amount=${pkg.price}`}
                        className="px-4 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
                      >
                        Buy All
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
                  <div className="h-44 bg-gray-200" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-16 text-center shadow-sm">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No {isVideoSection ? 'video courses' : 'exams'} found</h3>
              <p className="text-gray-500 text-sm mb-4">Try adjusting your search or filters</p>
              <button onClick={clearFilters} className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4 lg:hidden">{filtered.length} {isVideoSection ? 'course' : 'exam'}{filtered.length !== 1 ? 's' : ''}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((course) => (
                  <Link
                    key={course.id}
                    href={`/student/courses/${course.id}`}
                    className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1"
                  >
                    <div className="relative h-44 bg-gradient-to-br from-teal-50 to-blue-50">
                      {course.image_url ? (
                        <Image src={course.image_url} alt={course.title} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-20">📘</div>
                      )}
                      {course.is_enrolled && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                          Enrolled
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${subjectColor(course.subject)}`}>{course.subject}</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Grade {course.grade}</span>
                        {course.stream_ids && course.stream_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {course.stream_ids.map(sid => (
                              <span key={sid} className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-[10px] font-medium border border-teal-100">
                                {streams.find(s => s.id === sid)?.name || 'Stream'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm leading-snug mb-3 group-hover:text-teal-600 transition-colors line-clamp-2">
                        {course.title}
                      </h3>
                      {course.description && (
                        <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{course.description}</p>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className={`font-bold text-base ${course.price === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                          {course.price === 0 ? 'Free' : `LKR ${course.price.toLocaleString()}`}
                        </span>
                        <span className="text-xs font-semibold text-teal-600 group-hover:underline">
                          {course.is_enrolled ? 'Open →' : 'Enrol →'}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
