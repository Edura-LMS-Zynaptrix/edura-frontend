'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAppSelector } from '@/lib/redux/hooks'
import ProfileDropdown from './ProfileDropdown'
import AdminNavbar from './AdminNavbar'

const navLinks = [
  { href: '/student/courses', label: 'Exam Courses' },
  { href: '/student/video-courses', label: 'Video Courses' },
  { href: '/student/rankings', label: 'Rankings' },
  { href: '/info', label: 'About' },
]

export default function Navbar() {
  const pathname = usePathname()
  const { isAuthenticated, user, needsProfileCompletion } = useAppSelector((state) => state.auth)
  const [menuOpen, setMenuOpen] = useState(false)

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  const hiddenRoutes = ['/login', '/register']
  if (hiddenRoutes.includes(pathname)) return null
  if (pathname.startsWith('/admin')) return <AdminNavbar />

  const navLinks = [
    { href: '/student/video-courses', label: 'Video Courses' },
    { href: '/student/courses', label: 'Exam Courses' },
    { href: '/student/class-packages', label: 'Class Packages' },
    { href: '/student/rankings', label: 'Rankings' },
  ]

  // Edura's roles are student/teacher/admin — teacher has no dedicated
  // management UI yet, so it falls back to the generic dashboard rather
  // than the student-only "My Courses" page.
  const portal =
    user?.role === 'admin'
      ? { href: '/admin/dashboard', label: 'Admin Portal' }
      : user?.role === 'teacher'
      ? { href: '/dashboard', label: 'Dashboard' }
      : { href: '/student/my-courses', label: 'My Courses' }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-lg">🎓</div>
            <span className="text-xl font-bold text-gray-900">Edura</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {!needsProfileCompletion && navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === href || pathname.startsWith(href + '/')
                    ? 'text-teal-700 bg-teal-50'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {label === 'Rankings' && isAuthenticated ? 'My Rankings' : label}
              </Link>
            ))}
            {isAuthenticated && !needsProfileCompletion && (
              <Link
                href={portal.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith(portal.href) ? 'text-teal-700 bg-teal-50' : 'text-teal-700 hover:bg-teal-50'
                }`}
              >
                {portal.label}
              </Link>
            )}
          </div>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <ProfileDropdown />
            ) : (
              <>
                <Link href="/login" className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors rounded-lg hover:bg-gray-50">
                  Sign In
                </Link>
                <Link href="/register" className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile right: profile icon (if auth) + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            {isAuthenticated && <ProfileDropdown />}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-2 space-y-1 shadow-lg">
          {!needsProfileCompletion && navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === href || pathname.startsWith(href + '/')
                  ? 'text-teal-700 bg-teal-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label === 'Rankings' && isAuthenticated ? 'My Rankings' : label}
            </Link>
          ))}
          {isAuthenticated && !needsProfileCompletion && (
            <Link
              href={portal.href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(portal.href) ? 'text-teal-700 bg-teal-50' : 'text-teal-700 hover:bg-teal-50'
              }`}
            >
              {portal.label}
            </Link>
          )}
          {!isAuthenticated && (
            <div className="pt-2 flex flex-col gap-2 border-t border-gray-100 mt-2">
              <Link href="/login" className="w-full text-center px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="w-full text-center px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
