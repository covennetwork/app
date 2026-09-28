'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Connector } from 'wagmi'

// Which wallet connectors to actually show. wagmi keeps every configured connector in the list
// regardless of whether it can work here, so two of them need hiding:
//
// - The generic `injected` connector is present even when the browser has no injected provider
//   (a plain mobile browser tab). Connecting it there does nothing, so it is hidden unless
//   window.ethereum exists — inside a wallet's in-app browser it does, and it stays visible.
// - The Safe connector only has a provider inside the Safe{Wallet} app iframe; elsewhere it
//   always throws "Provider not found", so it is hidden unless we are running as a Safe App
//   (in an iframe) and the surface opts into it.
//
// Detection touches `window`, so it runs in an effect and both values start "off" to keep the
// server and first client render identical (no hydration mismatch); the real values settle in
// right after mount.
export function useVisibleConnectors(connectors: readonly Connector[], options: { allowSafe?: boolean } = {}): Connector[] {
  const { allowSafe = false } = options
  const [hasInjected, setHasInjected] = useState(false)
  const [inIframe, setInIframe] = useState(false)

  useEffect(() => {
    setHasInjected(typeof window !== 'undefined' && Boolean((window as { ethereum?: unknown }).ethereum))
    setInIframe(typeof window !== 'undefined' && window.parent !== window)
  }, [])

  return useMemo(
    () =>
      connectors.filter((connector) => {
        if (connector.type === 'injected') return hasInjected
        if (connector.type === 'safe') return allowSafe && inIframe
        return true
      }),
    [connectors, hasInjected, inIframe, allowSafe],
  )
}
