import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '../providers'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Coven Swap',
  description: 'Swap on Arc.',
  // Embedded widgets are indexed on their own; keep them out of search results.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// The embed root has no site chrome (no announcement bar, no footer) and a transparent body so
// the widget blends into whatever host page frames it. It paints its own surface from the `bg`
// parameter. Wallet/query providers still live here; the Coven client is provided per-widget
// from the integrator config in the URL.
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans text-black antialiased" style={{ background: 'transparent' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
