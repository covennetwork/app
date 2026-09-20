import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Footer } from '@/components/Footer'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Coven | Swap and bridge on Arc ',
  description: 'Swap and bridge on Arc.',
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-dvh flex-col bg-black font-sans text-white antialiased">
        <Providers>
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
