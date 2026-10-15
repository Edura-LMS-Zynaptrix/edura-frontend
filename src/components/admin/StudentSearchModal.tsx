'use client'

import React, { useState, useEffect } from 'react'
import { Search, User, X, Loader2, MessageSquarePlus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAdminStudents, AdminStudent } from '@/lib/api/admin'

interface StudentSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectStudent: (student: AdminStudent) => void
  isProcessing?: boolean
}

export default function StudentSearchModal({ 
  isOpen, 
  onClose, 
  onSelectStudent,
  isProcessing = false 
}: StudentSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('')
      setStudents([])
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setIsLoading(true)
        try {
          const response = await getAdminStudents({ search: searchTerm, limit: 10 })
          setStudents(response.students)
        } catch (error) {
          console.error('Failed to search students:', error)
        } finally {
          setIsLoading(false)
        }
      } else {
        setStudents([])
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-teal-600" />
            New Conversation
          </h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              autoFocus
              type="text"
              placeholder="Search by name, email or school..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-[300px] custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              <p className="text-sm font-medium">Searching students...</p>
            </div>
          ) : students.length > 0 ? (
            <div className="space-y-1">
              {students.map((student) => (
                <button
                  key={student.user_id}
                  disabled={isProcessing}
                  onClick={() => onSelectStudent(student)}
                  className="w-full flex items-center gap-4 p-3 hover:bg-teal-50 rounded-xl transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold border-2 border-white shadow-sm">
                    {student.full_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{student.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{student.email} • Grade {student.grade}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{student.school}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="px-3 py-1 bg-teal-600 text-white text-[10px] font-bold rounded-lg shadow-lg shadow-teal-600/20">
                      SELECT
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searchTerm.length >= 2 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400 gap-3">
              <User className="w-12 h-12 opacity-20" />
              <p className="text-sm font-medium">No students found matching "{searchTerm}"</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400 gap-3">
              <Search className="w-12 h-12 opacity-10" />
              <p className="text-sm font-medium italic">Type at least 2 characters to search</p>
            </div>
          )}
        </div>
        
        {isProcessing && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-50">
            <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl shadow-xl border border-gray-100">
              <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
              <span className="text-sm font-bold text-gray-900">Initializing chat...</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
