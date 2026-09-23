'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'coven.announce.arb'

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') setDismissed(true)
    } catch {
      // private windows can throw on storage access; the bar simply stays visible
    }
  }, [])

  if (dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // nothing to persist
    }
  }

  return (
    <div className="w-full bg-black text-[#EFECE4]">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-1 px-6 py-1.5 text-xs">
        <span className="min-w-0 truncate text-[#EFECE4]/80">
          Automated arbitrage is live on Arc.
        </span>
        <a href="https://docs.coven.network/arbitrage/overview/" className="tap shrink-0 whitespace-nowrap underline underline-offset-2">
          Learn more
        </a>
        <button type="button" onClick={dismiss} className="tap shrink-0 text-[#EFECE4]/60 ms-auto" aria-label="Dismiss announcement">
          ✕
        </button>
      </div>
    </div>
  )
}
