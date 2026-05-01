import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth'

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm',
})

export const metadata: Metadata = {
  title: 'BTC Trustee Quant V3 — Premium Trading Terminal',
  description: 'World-class premium fintech trading terminal with real-time BTC signals, advanced charts, and AI-powered analysis.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BTC Trustee Quant',
  },
  formatDetection: {
    telephone: false,
  },
  applicationName: 'BTC Trustee Quant V3',
}

export const viewport: Viewport = {
  themeColor: '#0B0F19',
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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
