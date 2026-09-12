import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/lib/redux/provider'
import NotificationManager from '@/components/NotificationManager'
import AuthInitializer from '@/components/AuthInitializer'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import GoogleAuthProvider from '@/components/GoogleAuthProvider'
import BadgeCelebration from '@/components/badges/BadgeCelebration'
import ChatWidget from '@/components/chat/ChatWidget'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://www.edura.com'),
  title: {
    default: 'Edura | Online Exam Preparation Platform',
    template: '%s | Edura',
  },
  description:
    'Edura is an online exam preparation platform for O/L and A/L students with timed MCQ exams, rankings, and progress tracking.',
  keywords: [
    'Edura',
    'OL exam preparation',
    'AL exam preparation',
    'MCQ practice',
    'online exam platform',
    'Sri Lanka exams',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Edura | Online Exam Preparation Platform',
    description:
      'Prepare for O/L and A/L exams with timed MCQ papers, rankings, and progress insights on Edura.',
    url: 'https://www.edura.com',
    siteName: 'Edura',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/logo.svg',
        width: 1200,
        height: 630,
        alt: 'Edura',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Edura | Online Exam Preparation Platform',
    description:
      'Practice O/L and A/L exams with timed MCQ papers and real-time rankings.',
    images: ['/logo.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.svg',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#0d9488',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Edura',
        url: 'https://www.edura.com',
        logo: 'https://www.edura.com/logo.svg',
      },
      {
        '@type': 'WebSite',
        name: 'Edura',
        url: 'https://www.edura.com',
      },
    ],
  }

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <GoogleAuthProvider>
            <AuthInitializer />
            <Navbar />
            <Suspense fallback={null}>
              {children}
            </Suspense>
            <Footer />
            <NotificationManager />
            <BadgeCelebration />
            <ChatWidget />
          </GoogleAuthProvider>
        </Providers>
      </body>
    </html>
  )
}
