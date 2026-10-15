/**
 * ChatWidget Component - Floating chat UI for students
 */
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { 
  fetchChatHistoryThunk, 
  sendMessageThunk, 
  setSessionId,
  clearChatError 
} from '@/lib/redux/slices/chatSlice'
import { MessageCircle, X, Send, User, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ChatWidget() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const dispatch = useAppDispatch()
  const { messages, sessionId, isLoading } = useAppSelector((state) => state.chat)
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Initialize session ID if not exists
  useEffect(() => {
    if (!sessionId) {
      const newId = crypto.randomUUID()
      dispatch(setSessionId(newId))
    }
  }, [sessionId, dispatch])

  // Fetch history with polling
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchChatHistoryThunk(sessionId || undefined))
      
      const interval = setInterval(() => {
        dispatch(fetchChatHistoryThunk(sessionId || undefined))
      }, 5000) // Poll every 5 seconds for real-time experience
      
      return () => clearInterval(interval)
    }
  }, [isOpen, sessionId, dispatch])

  // Track unread messages when widget is closed
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.is_from_admin && !lastMsg.is_read) {
        // Simple logic: if the last message is from admin and we haven't seen it, show notification
        setUnreadCount(prev => prev + 1)
      }
    } else if (isOpen) {
      setUnreadCount(0)
    }
  }, [messages, isOpen])

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    const msg = message
    setMessage('')
    await dispatch(sendMessageThunk({ 
      message: msg, 
      sessionId: isAuthenticated ? undefined : (sessionId || undefined) 
    })).unwrap()
  }

  // Hide on admin routes (placed after hooks to avoid React violation)
  if (pathname?.startsWith('/admin')) {
    return null
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-80 sm:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold">Edura Chat</h3>
                  <p className="text-xs text-teal-100">Ask us anything!</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
            >
              {messages.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MessageCircle className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">No messages yet</p>
                  <p className="text-xs text-gray-400">Send a message to start chatting with our team.</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.is_from_admin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                      msg.is_from_admin 
                        ? 'bg-white text-gray-800 rounded-tl-none border border-gray-100' 
                        : 'bg-teal-600 text-white rounded-tr-none'
                    }`}>
                      {msg.message}
                      <div className={`text-[10px] mt-1 ${msg.is_from_admin ? 'text-gray-400' : 'text-teal-100 text-right'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer / Input */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-100 flex gap-2">
              <input 
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 outline-none transition-all"
              />
              <button 
                type="submit"
                disabled={!message.trim()}
                className="p-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all transform active:scale-95 relative ${
          isOpen ? 'bg-white text-gray-500 rotate-90' : 'bg-teal-600 text-white'
        }`}
      >
        {isOpen ? <ChevronDown className="w-8 h-8" /> : <MessageCircle className="w-8 h-8" />}
        
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
