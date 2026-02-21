import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Creator Engine - Video Uniquification Platform',
  description:
    'Transform your videos into unique variants that bypass duplicate content detection. AI-powered watermark removal and batch processing.',
  keywords: [
    'video uniquification',
    'creator engine',
    'video variants',
    'watermark removal',
    'OFM',
    'content management',
  ],
  authors: [{ name: 'Creator Engine' }],
  openGraph: {
    title: 'Creator Engine - Video Uniquification Platform',
    description:
      'Turn one video into 100 unique variants. Stop getting flagged for duplicate content.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Creator Engine',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Creator Engine',
    description: 'Turn one video into 100 unique variants.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
