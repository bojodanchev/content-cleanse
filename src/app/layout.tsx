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
  metadataBase: new URL('https://creatorengine.app'),
  title: 'Creator Engine - Content Uniquification Platform',
  description:
    'Turn one video or photo into thousands of unique variants. Manual & AI captions, face swap, photo cleaning, carousel multiply — all from one platform. Stop getting flagged for duplicate content.',
  keywords: [
    'video uniquification',
    'photo uniquification',
    'creator engine',
    'video variants',
    'photo variants',
    'watermark removal',
    'face swap',
    'AI captions',
    'manual captions',
    'photo cleaning',
    'carousel multiply',
    'content management',
  ],
  authors: [{ name: 'Creator Engine' }],
  openGraph: {
    title: 'Creator Engine - Content Uniquification Platform',
    description:
      'Turn one video or photo into thousands of unique variants. Captions. Face Swap. Photo Cleaning. Carousel Multiply. All from one dashboard.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Creator Engine',
    url: 'https://creatorengine.app',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Creator Engine - Content Uniquification Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Creator Engine - Content Uniquification Platform',
    description:
      'Turn one video or photo into thousands of unique variants. Captions. Face Swap. Photo Cleaning. Carousel Multiply.',
    images: ['/og-image.png'],
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
