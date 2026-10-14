import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata: Metadata = {
  title: 'kuraku-api',
  description: 'Metadata API for Kuraku.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
