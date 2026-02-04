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
  title: 'Content Cleanse - Video Uniquification Platform',
  description:
    'Transform your videos into unique variants that bypass duplicate content detection. AI-powered watermark removal and batch processing.',
  keywords: [
    'video uniquification',
    'content cleanse',
    'video variants',
    'watermark removal',
    'OFM',
    'content management',
  ],
  authors: [{ name: 'Content Cleanse' }],
  openGraph: {
    title: 'Content Cleanse - Video Uniquification Platform',
    description:
      'Turn one video into 100 unique variants. Stop getting flagged for duplicate content.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Content Cleanse',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Content Cleanse',
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
