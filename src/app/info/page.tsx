'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchPlatformStats } from '@/lib/redux/slices/studentDashboardSlice'

const faqs = [
  {
    q: 'Who is Edura for?',
    a: 'Edura is designed for Sri Lankan students in Grades 10–13 who are preparing for O/L and A/L examinations. Whether you are just starting or doing last-minute revision, Edura has the practice papers and tools you need.',
  },
  {
    q: 'How does course enrollment work?',
    a: 'Browse available courses, select one that matches your grade and subject, and complete payment via bank slip upload. Once an admin verifies your payment, you get instant access to all exams in that course.',
  },
  {
    q: 'Are there free exams available?',
    a: 'Yes! Some exams are marked as free and can be attempted without purchasing a course. Free exams are a great way to experience the platform before enrolling.',
  },
  {
    q: 'How are rankings calculated?',
    a: 'Rankings are calculated per subject based on your highest score percentage. In case of a tie, the student with the shorter time taken is ranked higher. Your district rank is calculated among students in the same district.',
  },
  {
    q: 'Can I re-attempt an exam?',
    a: 'Yes, you can attempt an exam multiple times. Only your best score counts toward the leaderboard ranking, though all attempts are visible in your My Analytics.',
  },
  {
    q: 'How do I pay for a course?',
    a: 'After selecting a course, you will be shown bank transfer details. Upload a photo of your payment slip. An admin reviews and approves it — usually within 24 hours — and your enrollment is activated automatically.',
  },
]

const features = [
  { icon: '📚', title: 'Structured Courses', desc: 'Subject-based course packages for every O/L and A/L stream.' },
  { icon: '⏱️', title: 'Timed Exams', desc: 'Real exam simulation with countdown timers.' },
  { icon: '📊', title: 'Instant Analytics', desc: 'Score breakdowns and progress tracking after every attempt.' },
  { icon: '🏆', title: 'Live Rankings', desc: 'Island-wide and district leaderboards updated after every exam.' },
  { icon: '✅', title: 'Detailed Solutions', desc: 'Full explanations for every question so you learn from mistakes.' },
  { icon: '📱', title: 'Mobile Friendly', desc: 'Fully responsive — practice from any device, anywhere.' },
]

export default function InfoPage() {
  const dispatch = useAppDispatch()
  const stats = useAppSelector((state) => state.studentDashboard.platformStats)

  useEffect(() => {
    if (!stats) {
      dispatch(fetchPlatformStats())
    }
  }, [dispatch, stats])

  return (
    <main className="min-h-screen bg-white">

      {/* Hero */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-16 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 border border-white/25 text-white/90 rounded-full text-sm font-semibold mb-6">
            About Edura
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
            Built for Sri Lankan Students
          </h1>
          <p className="text-xl text-teal-100 max-w-2xl mx-auto leading-relaxed">
            Edura is a dedicated online exam preparation platform designed to help O/L and A/L students practice smarter, track their performance, and compete with peers island-wide.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <span className="inline-block px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-sm font-semibold mb-4">Our Mission</span>
              <h2 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">
                Making Quality Exam Prep Available to Every Student
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                We believe every student in Sri Lanka deserves access to high-quality practice material, regardless of where they live or which school they attend. Edura bridges the gap between urban and rural students by putting the nation&apos;s best MCQ papers online.
              </p>
              <p className="text-gray-600 leading-relaxed">
                From subject-specific course packages to island-wide leaderboards, our platform is built around one goal: helping you walk into your exams confident, prepared, and ready to succeed.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: stats ? stats.total_students.toLocaleString() + '+' : '—', label: 'Registered Students', color: 'bg-teal-50 border-teal-200', text: 'text-teal-600' },
                { value: stats ? stats.total_exams + '+' : '—', label: 'Practice Exams', color: 'bg-blue-50 border-blue-200', text: 'text-blue-600' },
                { value: stats ? stats.total_courses.toString() : '—', label: 'Active Courses', color: 'bg-purple-50 border-purple-200', text: 'text-purple-600' },
                { value: stats ? stats.total_attempts.toLocaleString() + '+' : '—', label: 'Exam Attempts', color: 'bg-orange-50 border-orange-200', text: 'text-orange-500' },
              ].map(({ value, label, color, text }) => (
                <div key={label} className={`rounded-2xl border p-6 text-center ${color}`}>
                  <div className={`text-3xl font-extrabold mb-1 ${text}`}>{value}</div>
                  <div className="text-sm text-gray-600 font-medium">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold mb-3">Platform Features</span>
            <h2 className="text-4xl font-bold text-gray-900">Everything You Need to Excel</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">Tools specifically built for the Sri Lankan O/L and A/L curriculum</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon, title, desc }) => (
              <div key={title} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all hover:-translate-y-0.5">
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-sm font-semibold mb-3">Simple Process</span>
            <h2 className="text-4xl font-bold text-gray-900">How Edura Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-teal-200 via-blue-200 to-purple-200 z-0" />
            {[
              { step: '01', icon: '✍️', title: 'Create Account', desc: 'Sign up with your school, district, and grade' },
              { step: '02', icon: '📘', title: 'Enrol in Courses', desc: 'Choose O/L or A/L courses and complete payment' },
              { step: '03', icon: '⚡', title: 'Practice & Compete', desc: 'Attempt timed papers and rank island-wide' },
              { step: '04', icon: '📊', title: 'Track Progress', desc: 'Review scores, rankings, and improvement areas' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="relative z-10 bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
                <div className="text-3xl mb-3">{icon}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Step {step}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-sm font-semibold mb-3">FAQ</span>
            <h2 className="text-4xl font-bold text-gray-900">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group bg-white border border-gray-200 rounded-2xl p-6 cursor-pointer">
                <summary className="flex items-center justify-between font-semibold text-gray-900 list-none">
                  {q}
                  <span className="ml-4 flex-shrink-0 w-6 h-6 bg-gray-100 group-open:bg-teal-100 rounded-full flex items-center justify-center transition-colors">
                    <svg className="w-3.5 h-3.5 text-gray-600 group-open:text-teal-600 group-open:rotate-180 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-4 text-gray-600 leading-relaxed text-sm">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 bg-green-50 text-green-600 rounded-full text-sm font-semibold mb-3">Get in Touch</span>
            <h2 className="text-4xl font-bold text-gray-900">Contact Us</h2>
            <p className="text-gray-500 mt-3">Have a question or need help? We&apos;re here for you.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '📧', label: 'Email', value: 'support@edura.lk', sub: 'We reply within 24 hours' },
              { icon: '📍', label: 'Location', value: 'Sri Lanka', sub: 'Serving students island-wide' },
              { icon: '🕐', label: 'Support Hours', value: '8am – 8pm', sub: 'Monday to Saturday' },
            ].map(({ icon, label, value, sub }) => (
              <div key={label} className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-3">{icon}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
                <div className="font-bold text-gray-900">{value}</div>
                <div className="text-sm text-gray-500 mt-1">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-teal-100 text-xl mb-10">
            Join thousands of students already preparing smarter with Edura.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="px-10 py-4 bg-white text-teal-700 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-xl shadow-black/20">
              Create Free Account
            </Link>
            <Link href="/student/courses" className="px-10 py-4 bg-white/10 border border-white/30 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors">
              Browse Courses
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
