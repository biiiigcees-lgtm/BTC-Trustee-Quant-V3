import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm',
})

export const metadata: Metadata = {
  title: 'BTC Binary Oracle — AI-Powered Trading Terminal',
  description: 'Advanced BTC prediction terminal with AI optimizer, live charts, technical indicators, and ensemble model analysis.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BTC Oracle',
  },
  formatDetection: {
    telephone: false,
  },
  applicationName: 'BTC Binary Oracle',
}

export const viewport: Viewport = {
  themeColor: '#00ffe7',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${ibmPlexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
