'use client'

import { useEffect, useState } from 'react'
import OptionWheel from './OptionWheel'

export function Wheel({
  items,
  onSelect,
  defaultSelected = 0,
}: {
  items: string[]
  onSelect: (index: number, item: string) => void
  defaultSelected?: number
}) {
  const start = Math.min(Math.max(defaultSelected, 0), Math.max(items.length - 1, 0))
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)')
    const sync = () => setNarrow(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  if (items.length === 0) {
    return <p className="py-16 text-2xl tracking-tight text-white/40">Nothing here yet.</p>
  }
  return (
    <div className="h-[clamp(12rem,26vh,16rem)] w-full">
      <OptionWheel
        items={items}
        defaultSelected={start}
        onChange={onSelect}
        side="left"
        textColor="rgba(255,255,255,0.35)"
        activeColor="#ffffff"
        fontSize={narrow ? 1.7 : 2.6}
        spacing={narrow ? 1.6 : 1.5}
        blur={2}
        fade={0.4}
        minOpacity={0}
        loop={items.length > 6}
        inset={0}
        className="w-full"
      />
    </div>
  )
}
