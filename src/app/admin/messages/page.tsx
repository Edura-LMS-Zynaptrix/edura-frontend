/**
 * Admin Messages Page - ChatGPT-Style Overhaul
 * Premium, conversational interface for managing student interactions.
 */
'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { 
  fetchAdminConversationsThunk,
  fetchAdminMessagesThunk, 
  adminReplyThunk,
  setActiveConversation,
  deleteAdminConversationThunk,
  initiateConversationWithStudentThunk
} from '@/lib/redux/slices/chatSlice'
import {
  fetchAllFeedbackThunk,
  markReadThunk,
  deleteFeedbackThunk,
  setActiveFeedback
} from '@/lib/redux/slices/feedbackSlice'
import { 
  Search, Send, User, Clock, MessageSquare, 
  Check, CheckCheck, Menu, X, Plus, Sparkles,
  ShieldCheck, History, Users, Ghost, Bot, MoreHorizontal,
  Trash2, AlertCircle, Inbox, MessageCircle,
  UserPlus
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import StudentSearchModal from '@/components/admin/StudentSearchModal'

// Helper for native date formatting to bypass date-fns build issues
const formatTime = (dateStr: string | Date | undefined) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateLine = (dateStr: string | Date | undefined) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const isSameDay = (d1: Date, d2: Date) => 
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const isToday = (date: Date) => isSameDay(date, new Date());
const isYesterday = (date: Date) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
};

export default function AdminMessagesPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)
  const { conversations, messages, activeConversationId, isConversationsLoading, isLoading } = useAppSelector((state) => state.chat)
  const feedbackState = useAppSelector((state) => state.feedback)
  
  const [viewMode, setViewMode] = useState<'messages' | 'feedback'>('messages')
  const [reply, setReply] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Use a ref to store active ID for deletion to avoid closure issues
  const activeDeletionId = deleteTargetId || activeConversationId

  const handleDeleteTarget = async () => {
    const targetId = activeDeletionId
    if (viewMode === 'messages' && targetId) {
      try {
        setErrorState(null)
        await dispatch(deleteAdminConversationThunk(targetId)).unwrap()
        setShowDeleteConfirm(false)
        setDeleteTargetId(null)
      } catch (err: any) {
        setErrorState(err || "Failed to delete conversation")
      }
    } else if (viewMode === 'feedback' && feedbackState.activeFeedbackId) {
      try {
        setErrorState(null)
        await dispatch(deleteFeedbackThunk(feedbackState.activeFeedbackId)).unwrap()
        setShowDeleteConfirm(false)
      } catch (err: any) {
        setErrorState(err || "Failed to delete feedback")
      }
    }
  }

  // Auth check
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      router.push('/')
    }
  }, [user, router])

  // Data fetching
  useEffect(() => {
    if (viewMode === 'messages') {
      dispatch(fetchAdminConversationsThunk())
    } else {
      dispatch(fetchAllFeedbackThunk())
    }
  }, [dispatch, viewMode])

  useEffect(() => {
    if (viewMode === 'messages') {
      const interval = setInterval(() => {
        dispatch(fetchAdminConversationsThunk())
      }, 7000)
      return () => clearInterval(interval)
    }
  }, [dispatch, viewMode])

  useEffect(() => {
    if (activeConversationId && viewMode === 'messages') {
      dispatch(fetchAdminMessagesThunk(activeConversationId))
      const interval = setInterval(() => {
        dispatch(fetchAdminMessagesThunk(activeConversationId))
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [activeConversationId, dispatch, viewMode])

  // Scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages])

  const handleConversationSelect = (id: string) => {
    dispatch(setActiveConversation(id))
    if (window.innerWidth < 768) setIsSidebarOpen(false)
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim() || !activeConversationId) return

    const msg = reply
    setReply('')
    try {
      await dispatch(adminReplyThunk({ 
        conversationId: activeConversationId, 
        message: msg 
      })).unwrap()
      dispatch(fetchAdminConversationsThunk())
    } catch (err) {
      setReply(msg) // Rollback on error
    }
  }

  const handleSelectStudentForChat = async (student: any) => {
    try {
      setErrorState(null)
      await dispatch(initiateConversationWithStudentThunk(student.user_id)).unwrap()
      setIsSearchModalOpen(false)
      if (window.innerWidth < 768) setIsSidebarOpen(false)
    } catch (err: any) {
      setErrorState(err || "Failed to initiate conversation")
    }
  }

  // Categorization Logic
  const categorizedConversations = useMemo(() => {
    const filtered = conversations.filter(c => 
      c.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.last_message?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const today = new Date()
    const groups: { [key: string]: typeof conversations } = {
      'Active Now': [],
      'Today': [],
      'Yesterday': [],
      'Previous': []
    }

    filtered.forEach(c => {
      const msgDate = new Date(c.last_message_at)
      if (c.unread_count > 0) groups['Active Now'].push(c)
      else if (isToday(msgDate)) groups['Today'].push(c)
      else if (isYesterday(msgDate)) groups['Yesterday'].push(c)
      else groups['Previous'].push(c)
    })

    return groups
  }, [conversations, searchTerm])

  const activeConv = conversations.find(c => c.id === activeConversationId)

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) return null

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#FCFCFD] overflow-hidden font-sans">
      {/* ChatGPT-style Dark Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.div 
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-16 left-0 z-40 w-72 sm:w-80 bg-[#202123] text-gray-100 flex flex-col shrink-0 border-r border-white/10"
          >
            {/* Sidebar Header with Toggle */}
            <div className="p-4 flex flex-col gap-4">
              <button 
                onClick={() => {
                  dispatch(setActiveConversation(null))
                  dispatch(setActiveFeedback(null))
                  router.push('/admin/dashboard')
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 border border-white/20 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors group"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                Back to Dashboard
              </button>

              <button 
                onClick={() => setIsSearchModalOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-teal-900/20 transition-all active:scale-95 group"
              >
                <UserPlus className="w-4 h-4" />
                New Conversation
              </button>

              {/* View Mode Toggle */}
              <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
                <button 
                  onClick={() => setViewMode('messages')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold rounded-lg transition-all ${
                    viewMode === 'messages' ? 'bg-[#343541] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <MessageCircle size={14} />
                  CHATS
                </button>
                <button 
                  onClick={() => setViewMode('feedback')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold rounded-lg transition-all ${
                    viewMode === 'feedback' ? 'bg-[#343541] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Inbox size={14} />
                  FEEDBACK
                </button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input 
                  type="text"
                  placeholder={viewMode === 'messages' ? "Search students..." : "Search feedback..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-transparent border border-white/10 rounded-lg text-xs focus:outline-none focus:border-teal-500/50 transition-all placeholder:text-gray-600"
                />
              </div>
            </div>

            {/* Dynamic List Content */}
            <div className="flex-1 overflow-y-auto px-2 space-y-6 pb-20 custom-scrollbar">
              {viewMode === 'messages' ? (
                <>
                  {isConversationsLoading && conversations.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-xs animate-pulse">
                      Synchronizing threads...
                    </div>
                  ) : (
                    Object.entries(categorizedConversations).map(([group, items]) => (
                      items.length > 0 && (
                        <div key={group} className="space-y-1">
                          <h3 className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">{group}</h3>
                          {items.map((conv) => (
                            <div
                              key={conv.id}
                              onClick={() => handleConversationSelect(conv.id)}
                              className={`w-full group px-3 py-3 flex items-center gap-3 rounded-lg text-left transition-all cursor-pointer ${
                                activeConversationId === conv.id 
                                  ? 'bg-[#343541] shadow-sm' 
                                  : 'hover:bg-[#2A2B32]'
                              }`}
                            >
                              {conv.user_id ? (
                                <Users className={`w-4 h-4 ${conv.unread_count > 0 ? 'text-teal-400' : 'text-gray-500'}`} />
                              ) : (
                                <Ghost className="w-4 h-4 text-gray-600" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                  <p className="text-sm truncate pr-2 tracking-tight">{conv.student_name}</p>
                                  {conv.unread_count > 0 && (
                                    <span className="w-2 h-2 bg-teal-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 truncate mt-0.5 opacity-60">
                                  {conv.last_message || "No messages yet"}
                                </p>
                              </div>
                              
                              <div className="ml-auto">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteTargetId(conv.id)
                                    setShowDeleteConfirm(true)
                                    setErrorState(null)
                                  }}
                                  className="p-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-md transition-all border border-red-500/20 shadow-sm"
                                  title="Delete Chat"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ))
                  )}
                </>
              ) : (
                /* FEEDBACK LIST */
                <div className="space-y-1">
                  <h3 className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Student Feedback</h3>
                  {feedbackState.isLoading && feedbackState.items.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-xs animate-pulse">Fetching feedback...</div>
                  ) : feedbackState.items.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-xs italic">No feedback received yet</div>
                  ) : (
                    feedbackState.items
                      .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.message.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => dispatch(setActiveFeedback(item.id))}
                        className={`w-full group px-3 py-3 flex items-center gap-3 rounded-lg text-left transition-all cursor-pointer ${
                          feedbackState.activeFeedbackId === item.id 
                            ? 'bg-[#343541] shadow-sm' 
                            : 'hover:bg-[#2A2B32]'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${item.is_read ? 'bg-gray-700' : 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <p className={`text-sm truncate pr-2 tracking-tight ${item.is_read ? 'text-gray-400' : 'text-white'}`}>{item.name}</p>
                            <span className="text-[9px] text-gray-500 whitespace-nowrap">{formatDateLine(item.created_at)}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5 opacity-60 capitalize">
                            {item.category} • {item.message}
                          </p>
                        </div>
                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              dispatch(setActiveFeedback(item.id))
                              setShowDeleteConfirm(true)
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-400 rounded-md transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Sidebar User Footer */}
            <div className="mt-auto p-4 border-t border-white/10 bg-[#202123]/80 backdrop-blur-sm">
              <div className="flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-white/5 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded bg-teal-600 flex items-center justify-center text-xs font-bold shadow-lg">
                  {user.email?.[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{user.email}</p>
                  <p className="text-[10px] text-gray-500">Administrator</p>
                </div>
                <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'md:ml-[320px]' : 'ml-0'}`}>
        {/* Header Bar */}
        <header className="h-16 border-b border-gray-100 bg-white/70 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            >
              <Menu size={20} />
            </button>
            {viewMode === 'messages' ? (
              activeConv && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center border-2 border-white">
                    <User size={16} className="text-teal-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">{activeConv.student_name}</h2>
                    <p className="text-[10px] text-gray-500">
                      {activeConv.user_id ? 'Authenticated Student' : 'Guest Visitor'}
                    </p>
                  </div>
                </div>
              )
            ) : (
              feedbackState.activeFeedbackId && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-white">
                    <Inbox size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">
                      {feedbackState.items.find(f => f.id === feedbackState.activeFeedbackId)?.name}
                    </h2>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Feedback Details</p>
                  </div>
                </div>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-[10px] font-bold border border-green-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              System Status Online
            </div>

            {viewMode === 'messages' && activeConversationId && (
              <button 
                onClick={() => {
                  setDeleteTargetId(activeConversationId)
                  setShowDeleteConfirm(true)
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-100 rounded-lg transition-all font-bold text-[11px] shadow-sm active:scale-95 group"
              >
                <Trash2 size={14} className="transition-transform group-hover:rotate-12" />
                <span>CLEAR CHAT</span>
              </button>
            )}

            {viewMode === 'feedback' && feedbackState.activeFeedbackId && (
              <div className="flex items-center gap-2">
                {!feedbackState.items.find(f => f.id === feedbackState.activeFeedbackId)?.is_read && (
                  <button 
                    onClick={() => dispatch(markReadThunk(feedbackState.activeFeedbackId!))}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-100 rounded-lg transition-all font-bold text-[11px] shadow-sm"
                  >
                    <Check size={14} />
                    MARK AS READ
                  </button>
                )}
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-100 rounded-lg transition-all font-bold text-[11px] shadow-sm"
                >
                  <Trash2 size={14} />
                  DELETE
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {viewMode === 'messages' ? (
            activeConversationId ? (
              <>
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto px-4 md:px-0 py-8 space-y-12"
                >
                  <div className="max-w-3xl mx-auto w-full space-y-12">
                    <AnimatePresence initial={false}>
                      {messages.map((msg, idx) => (
                        <motion.div 
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-4 md:gap-6 ${msg.is_from_admin ? 'flex-row-reverse' : ''}`}
                        >
                          <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center shadow-sm border ${
                            msg.is_from_admin 
                              ? 'bg-teal-600 border-teal-500 text-white' 
                              : 'bg-white border-gray-100 text-gray-400'
                          }`}>
                            {msg.is_from_admin ? <Bot size={16} /> : <User size={16} />}
                          </div>
                          
                          <div className={`flex flex-col gap-1 max-w-[85%] ${msg.is_from_admin ? 'items-end text-right' : 'items-start text-left'}`}>
                            <div className={`text-base leading-relaxed text-gray-800 ${msg.is_from_admin ? 'font-medium text-gray-900' : ''}`}>
                              {msg.message}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] text-gray-400 font-medium">
                                {formatTime(msg.created_at)}
                              </span>
                              {msg.is_from_admin && (
                                <span className={msg.is_read ? "text-teal-500" : "text-gray-300"}>
                                  <CheckCheck size={12} />
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    
                    {isLoading && (
                      <div className="flex gap-4 items-center animate-pulse py-4">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg" />
                        <div className="h-4 bg-gray-100 rounded w-48" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Enhanced Floating Input */}
                <div className="sticky bottom-0 w-full p-4 md:p-8 bg-gradient-to-t from-white via-white/90 to-transparent pt-12">
                  <div className="max-w-3xl mx-auto relative">
                    <form 
                      onSubmit={handleSendReply}
                      className="relative group flex items-end gap-2 bg-white border border-gray-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.08)] focus-within:border-teal-200 transition-all py-2 pr-2 pl-4"
                    >
                      <textarea 
                        rows={1}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply(e as any);
                          }
                        }}
                        placeholder="Send a message..."
                        className="flex-1 py-3 bg-transparent border-none focus:ring-0 outline-none text-sm md:text-base text-gray-800 resize-none max-h-48 scrollbar-none"
                      />
                      <button 
                        type="submit"
                        disabled={!reply.trim() || isLoading}
                        className={`p-3 rounded-xl transition-all shadow-sm ${
                          reply.trim() 
                            ? 'bg-teal-600 text-white hover:bg-teal-700 scale-100 active:scale-95' 
                            : 'bg-gray-100 text-gray-400 scale-90 opacity-50'
                        }`}
                      >
                        <Send size={18} />
                      </button>
                    </form>
                    <p className="mt-3 text-center text-[10px] text-gray-400 font-medium">
                      Shift + Enter for new line • Edura Support AI
                    </p>
                  </div>
                </div>
              </>
            ) : (
              /* Empty State: Messages */
              <div className="flex-1 flex items-center justify-center p-8 bg-[#F9FAFB]/50">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-2xl w-full text-center space-y-12"
                >
                  <div className="space-y-4">
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Edura Support</h1>
                    <p className="text-gray-500 text-lg font-medium">Select a student thread to begin assisting</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { icon: History, title: "Chat History", desc: "Access guest and student logs" },
                      { icon: Sparkles, title: "Proactive Support", desc: "Identify and resolve friction" },
                      { icon: ShieldCheck, title: "Security First", desc: "Encrypted student sessions" }
                    ].map((card, i) => (
                      <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-left space-y-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <card.icon size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm italic">{card.title}</h3>
                          <p className="text-xs text-gray-500 leading-relaxed mt-1">{card.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            )
          ) : (
            /* FEEDBACK MODE MAIN AREA */
            feedbackState.activeFeedbackId ? (
              <div className="flex-1 overflow-y-auto p-12 bg-[#F9FAFB]/50">
                <div className="max-w-3xl mx-auto space-y-8">
                  {feedbackState.items.filter(f => f.id === feedbackState.activeFeedbackId).map(f => (
                    <motion.div 
                      key={f.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-8"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                            <User size={32} />
                          </div>
                          <div>
                            <h3 className="text-2xl font-black text-gray-900">{f.name}</h3>
                            <p className="text-gray-500 font-medium">{f.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-200">
                            {f.category}
                          </span>
                          <span className="text-[10px] text-gray-400 mt-2 font-bold">{new Date(f.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="p-10 bg-white rounded-3xl border border-gray-100 shadow-sm leading-relaxed text-gray-800 whitespace-pre-wrap min-h-[300px] text-lg italic">
                        {f.subject && <h4 className="text-xl font-bold text-gray-900 not-italic mb-6 border-b border-gray-50 pb-4">{f.subject}</h4>}
                        &ldquo;{f.message}&rdquo;
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              /* Empty State: Feedback */
              <div className="flex-1 flex items-center justify-center p-8 bg-[#F9FAFB]/50">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-xl w-full text-center space-y-8"
                >
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mx-auto">
                    <Inbox size={40} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Student Feedback</h2>
                    <p className="text-gray-500 font-medium italic">Select a suggestion or report from the sidebar to view details</p>
                  </div>
                </motion.div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
              
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                  <AlertCircle size={24} />
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {viewMode === 'messages' ? 'Clear Conversation?' : 'Delete Feedback?'}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                    {viewMode === 'messages' 
                      ? 'This will permanently delete all messages in this thread for both you and the student. This action cannot be undone.'
                      : 'This feedback entry will be permanently removed from the system. This action cannot be undone.'}
                  </p>
                </div>

                {errorState && (
                  <div className="w-full p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-600 font-medium">
                    {errorState}
                  </div>
                )}

                <div className="flex flex-col w-full gap-2 mt-2">
                  <button
                    onClick={handleDeleteTarget}
                    disabled={isLoading}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50"
                  >
                    {isLoading ? 'Processing...' : (viewMode === 'messages' ? 'Yes, clear chat' : 'Yes, delete feedback')}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Search Modal */}
      <StudentSearchModal 
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectStudent={handleSelectStudentForChat}
        isProcessing={isLoading}
      />
    </div>
  )
}
