/**
 * Student Feedback Page
 */
import FeedbackForm from '@/components/FeedbackForm'
import { Sparkles } from 'lucide-react'

export const metadata = {
  title: 'Give Feedback | Edura',
  description: 'Help us improve Edura by sharing your thoughts, suggestions, or reporting bugs.',
}

export default function FeedbackPage() {
  return (
    <main className="min-h-screen bg-[#F9FAFB] py-20 px-4">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-full text-xs font-bold tracking-widest uppercase border border-teal-100 shadow-sm">
            <Sparkles size={14} className="animate-pulse" />
            Shape the Future
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
            We value your <span className="text-teal-600">Feedback</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto font-medium italic leading-relaxed">
            Edura is built for you—let us know how we can make your study experience even better.
          </p>
        </div>

        <FeedbackForm />

        <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
          <div className="text-center space-y-2">
            <h4 className="font-bold text-gray-900 text-sm">Real Humans</h4>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">We read every message</p>
          </div>
          <div className="text-center space-y-2">
            <h4 className="font-bold text-gray-900 text-sm">Constant Updates</h4>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Feedback drives features</p>
          </div>
          <div className="text-center space-y-2">
            <h4 className="font-bold text-gray-900 text-sm">Privacy First</h4>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Secure & Anonymous options</p>
          </div>
        </div>
      </div>
    </main>
  )
}
