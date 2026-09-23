'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type MenuLink = { label: string; href: string; external?: boolean }

const LINKS: MenuLink[] = [
  { label: 'Arbitrage', href: 'https://docs.coven.network/arbitrage/overview/', external: true },
  { label: 'Widget', href: 'https://docs.coven.network/guides/widget/', external: true },
  { label: 'MCP', href: 'https://docs.coven.network/mcp/read/', external: true },
  { label: 'Let an agent trade', href: '/agent' },
  { label: 'Docs', href: 'https://docs.coven.network', external: true },
  { label: 'GitHub', href: 'https://github.com/covennetwork', external: true },
  { label: 'Contact', href: 'mailto:contact@coven.network', external: true },
]

export function FooterMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative ms-auto">
      <button
        type="button"
        className="tap flex items-center gap-1.5 text-2xs uppercase tracking-wide text-black/45"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Menu
        {/* <span aria-hidden className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ▾
        </span> */}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-full z-20 mb-3 min-w-[11rem] overflow-hidden rounded-xl border border-black/10 bg-[#F4F1EA] shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
        >
          {LINKS.map((link) =>
            link.external ? (
              <a
                key={link.label}
                role="menuitem"
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                className="block px-4 py-2.5 text-sm tracking-tight text-black/70 normal-case transition-colors hover:bg-black/[0.05] hover:text-black"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                role="menuitem"
                href={link.href}
                className="block px-4 py-2.5 text-sm tracking-tight text-black/70 normal-case transition-colors hover:bg-black/[0.05] hover:text-black"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  )
}
