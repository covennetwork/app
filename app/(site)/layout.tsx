import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { AnnouncementBar } from '@/components/AnnouncementBar'
import { Footer } from '@/components/Footer'
import { Providers } from '../providers'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Coven | Swap and bridge on Arc ',
  description: 'Swap and bridge on Arc.',
}

export const viewport: Viewport = {
  themeColor: '#EFECE4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-dvh flex-col font-sans text-black antialiased">
        <Providers>
          <AnnouncementBar />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
