'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()

  const hiddenRoutes = ['/login', '/register']
  if (hiddenRoutes.includes(pathname) || pathname.startsWith('/admin')) {
    return null
  }

  return (
    <footer className="bg-gray-900 text-gray-300 py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-lg">🎓</div>
              <span className="text-xl font-bold text-white">Edura</span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed">
              Sri Lanka&apos;s leading platform for O/L and A/L exam preparation - practice smarter, rank higher.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="font-semibold text-white mb-4">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/student/courses" className="hover:text-white transition-colors">Browse Courses</Link></li>
              <li><Link href="/student/rankings" className="hover:text-white transition-colors">Rankings</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-semibold text-white mb-4">Account</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/register" className="hover:text-white transition-colors">Register</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors">Login</Link></li>
              <li><Link href="/profile" className="hover:text-white transition-colors">My Profile</Link></li>
              <li><Link href="/student/my-courses" className="hover:text-white transition-colors">My Courses</Link></li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="font-semibold text-white mb-4">Info</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/info" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/info#features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/info#faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/info#contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/student/feedback" className="text-teal-400 hover:text-white transition-colors font-medium">Student Feedback</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <p>© 2026 Edura. All rights reserved.</p>
          <p>Empowering Sri Lankan students to achieve excellence 🇱🇰</p>
        </div>
      </div>
    </footer>
  )
}
