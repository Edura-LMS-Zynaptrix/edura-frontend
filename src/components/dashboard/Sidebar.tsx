'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'
import * as LucideIcons from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { getInitials } from '@/lib/utils/initials'
import { updateProfilePhoto, fetchCurrentUser } from '@/lib/redux/slices/authSlice'

interface SidebarProps {
  enrollments: any
}

const DashboardSidebar: React.FC<SidebarProps> = ({ enrollments }) => {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = getInitials(user?.profile?.full_name, user?.email)

  const navLinks = [
    { icon: LucideIcons.LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: LucideIcons.BookOpen, label: 'My Courses', href: '/student/my-courses' },
    { icon: LucideIcons.FileText, label: 'My Analytics', href: '/student/my-results' },
    { icon: LucideIcons.Trophy, label: 'My Rankings', href: '/student/rankings' },
    { icon: LucideIcons.Settings, label: 'Settings', href: '/profile' },
  ]

  const handlePhotoClick = () => {
    if (fileInputRef.current) fileInputRef.current.click()
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resAction = await dispatch(updateProfilePhoto(formData))
      if (updateProfilePhoto.fulfilled.match(resAction)) {
        await dispatch(fetchCurrentUser())
      }
    } catch (err) {
      console.error('Photo upload failed:', err)
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Profile Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="relative group cursor-pointer mb-4" onClick={handlePhotoClick}>
            {user?.profile?.profile_photo_url ? (
              <img
                src={user.profile.profile_photo_url}
                alt={user?.profile?.full_name || 'Profile'}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold text-3xl border-4 border-white shadow-md transition-transform group-hover:scale-105">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <LucideIcons.Camera size={24} className="text-white" />
            </div>
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-white/60 rounded-full flex items-center justify-center">
                <LucideIcons.Loader2 size={24} className="text-teal-600 animate-spin" />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
          <h2 className="text-xl font-bold text-gray-900 truncate w-full">
            {user?.profile?.full_name || user?.email}
          </h2>
          <p className="text-sm text-gray-500 mb-4 font-medium">Grade {user?.profile?.grade} • {user?.profile?.district}</p>
          <Link 
            href="/profile"
            className="w-full text-[12px] font-black uppercase tracking-[0.1em] text-[#00897B] hover:text-white bg-[#E0F2F1] hover:bg-[#00897B] py-3 rounded-full transition-all active:scale-[0.97] border border-[#B2DFDB] flex items-center justify-center"
          >
            EDIT PROFILE
          </Link>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-1">
        {navLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition-all group active:scale-[0.98]"
            >
              <Icon size={18} className="text-gray-400 group-hover:text-teal-600 transition-colors" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* Recent Enrollments (GitHub Style) */}
      <div className="space-y-3">
        <h3 className="px-4 text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
          Collections
        </h3>
        <div className="space-y-1">
          {enrollments?.courses?.slice(0, 5).map((item: any) => (
            <Link
              key={item.course.id}
              href={`/student/courses/${item.course.id}`}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-500 hover:text-teal-600 truncate transition-colors hover:bg-white rounded-lg shadow-none hover:shadow-sm"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
              <span className="truncate">{item.course.title}</span>
            </Link>
          ))}
          {(!enrollments?.courses || enrollments.courses.length === 0) && (
            <p className="px-4 text-xs text-gray-400 italic">No collections found</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardSidebar
