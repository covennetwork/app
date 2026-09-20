'use client'

import QRCode from 'qrcode'
import { useMemo } from 'react'

export function Qr({ value, size = 320 }: { value: string; size?: number }) {
  const { path, count } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const data = qr.modules.data
    const radius = 0.5
    let d = ''
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!data[y * n + x]) continue
        d += `M${x + 0.5} ${y} h0 a${radius} ${radius} 0 0 1 ${radius} ${radius} v0 a${radius} ${radius} 0 0 1 -${radius} ${radius} h0 a${radius} ${radius} 0 0 1 -${radius} -${radius} v0 a${radius} ${radius} 0 0 1 ${radius} -${radius} z `
      }
    }
    return { path: d, count: n }
  }, [value])

  return (
    <svg
      viewBox={`-1 -1 ${count + 2} ${count + 2}`}
      width={size}
      height={size}
      role="img"
      aria-label="WalletConnect QR code"
      className="rounded-[2rem] bg-white p-3"
    >
      <path d={path} fill="#000" />
    </svg>
  )
}
