'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAppSelector } from '@/lib/redux/hooks'
import ProfileDropdown from './ProfileDropdown'

const links = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/streams', label: 'Subjects & Streams' },
  { href: '/admin/courses', label: 'Courses' },
  { href: '/admin/class-packages', label: 'Class Packages' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/students', label: 'Students' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/rankings', label: 'Rankings' },
  { href: '/admin/messages', label: 'Messages' },
]

export default function AdminNavbar() {
  const pathname = usePathname()
  const { user } = useAppSelector((state) => state.auth)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [pathname])

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link href="/admin/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-lg">🎓</div>
            <div className="hidden sm:block">
              <p className="text-base font-bold text-gray-900 leading-tight">Edura</p>
              <p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider leading-tight">Admin Console</p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-0.5">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === href || pathname.startsWith(href + '/')
                    ? 'text-teal-700 bg-teal-50'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {label}
              </Link>
            ))}
            {user?.role === 'super_admin' && (
              <Link
                href="/admin/admins"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === '/admin/admins' || pathname.startsWith('/admin/admins/')
                    ? 'text-teal-700 bg-teal-50'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Admins
              </Link>
            )}
          </div>

          {/* Desktop right */}
          <div className="hidden lg:flex items-center gap-4">
             <div className="h-8 w-[1px] bg-gray-200 mx-1"></div>
             <ProfileDropdown />
          </div>

          {/* Mobile actions */}
          <div className="flex lg:hidden items-center gap-2">
            {user && <ProfileDropdown />}
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
        <div className="lg:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-2 space-y-1 shadow-lg overflow-y-auto max-h-[calc(100vh-4rem)]">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === href || pathname.startsWith(href + '/')
                  ? 'text-teal-700 bg-teal-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </Link>
          ))}
          {user?.role === 'super_admin' && (
            <Link
              href="/admin/admins"
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/admin/admins' || pathname.startsWith('/admin/admins/')
                  ? 'text-teal-700 bg-teal-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Manage Admins
            </Link>
          )}
          <Link 
            href="/admin/settings" 
            className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === '/admin/settings'
                ? 'text-teal-700 bg-teal-50'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            System Settings
          </Link>
        </div>
      )}
    </nav>
  )
}
