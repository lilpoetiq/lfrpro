import type { Metadata, Viewport } from 'next'
import './globals.css'
import Providers from './providers'
import RemoveDevIndicator from '@/components/RemoveDevIndicator'
import { DM_Sans, Syne, Nosifer } from 'next/font/google'

const fontSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const fontDisplay = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

/** Horror / drip display — sidebar lockup (approximates the painted wordmark). */
const fontLabel = Nosifer({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-label',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export const metadata: Metadata = {
  title: 'Legendary Fyre Records - Music Label Dashboard',
  description: 'Legendary Fyre Records - Music label dashboard and artist management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`dark ${fontSans.variable} ${fontDisplay.variable} ${fontLabel.variable}`}
      style={{ backgroundColor: '#000000' }}
      suppressHydrationWarning
    >
      <body
        className="bg-black text-white font-sans antialiased"
        style={{ backgroundColor: '#000000', color: '#ffffff', margin: 0, padding: 0 }}
      >
        <Providers>{children}</Providers>
        <RemoveDevIndicator />
      </body>
    </html>
  )
}

