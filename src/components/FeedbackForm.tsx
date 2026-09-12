'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { submitFeedbackThunk, clearFeedbackStatus } from '@/lib/redux/slices/feedbackSlice'
import { MessageSquare, Send, CheckCircle2, AlertCircle, Sparkles, Mail, User } from 'lucide-react'

export default function FeedbackForm() {
  const dispatch = useAppDispatch()
  const { isSubmitting, error, success } = useAppSelector((state) => state.feedback)
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'suggestion',
    subject: '',
    message: ''
  })

  // Pre-fill if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData(prev => ({
        ...prev,
        name: user.email.split('@')[0], // Fallback if name not in auth state
        email: user.email
      }))
    }
  }, [isAuthenticated, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await dispatch(submitFeedbackThunk(formData)).unwrap()
  }

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-12 rounded-3xl shadow-2xl border border-teal-100 text-center space-y-6 max-w-lg mx-auto"
      >
        <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto text-teal-600">
          <CheckCircle2 size={48} className="animate-bounce" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Thank You!</h2>
          <p className="text-gray-500 italic">Your feedback helps us make Edura better for everyone 🇱🇰</p>
        </div>
        <button 
          onClick={() => {
            dispatch(clearFeedbackStatus())
            setFormData(prev => ({ ...prev, message: '', subject: '' }))
          }}
          className="px-8 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20"
        >
          Send Another
        </button>
      </motion.div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
      >
        <div className="bg-gradient-to-tr from-teal-600 to-teal-500 p-8 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <MessageSquare size={120} />
          </div>
          <div className="relative z-10 flex items-center gap-4 mb-2">
            <Sparkles className="text-teal-200" size={24} />
            <h2 className="text-2xl font-extrabold tracking-tight">Share Your Thoughts</h2>
          </div>
          <p className="text-teal-50 text-sm font-medium opacity-90 max-w-sm">
            Have a suggestion, found a bug, or just want to say hi? We&apos;d love to hear from you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your Name"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent focus:border-teal-500 focus:bg-white rounded-2xl outline-none transition-all text-gray-700"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@email.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent focus:border-teal-500 focus:bg-white rounded-2xl outline-none transition-all text-gray-700"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Category</label>
            <div className="flex flex-wrap gap-2">
              {['suggestion', 'bug', 'praise', 'other'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                    formData.category === cat 
                      ? 'bg-teal-600 border-teal-600 text-white shadow-md' 
                      : 'bg-white border-gray-200 text-gray-500 hover:border-teal-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Subject (Optional)</label>
            <input 
              type="text"
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
              placeholder="What is this about?"
              className="w-full px-4 py-3.5 bg-gray-50 border border-transparent focus:border-teal-500 focus:bg-white rounded-2xl outline-none transition-all text-gray-700"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Message</label>
            <textarea 
              required
              rows={4}
              value={formData.message}
              onChange={e => setFormData({ ...formData, message: e.target.value })}
              placeholder="Tell us everything..."
              className="w-full px-4 py-3.5 bg-gray-50 border border-transparent focus:border-teal-500 focus:bg-white rounded-2xl outline-none transition-all text-gray-700 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 animate-shake">
              <AlertCircle size={18} />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 text-white rounded-2xl font-black text-sm tracking-widest transition-all shadow-xl shadow-teal-500/10 active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {isSubmitting ? 'SENDING...' : (
              <>
                <Send size={18} />
                SUBMIT FEEDBACK
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
