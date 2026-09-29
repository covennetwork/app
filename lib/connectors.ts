'use client'

import { useMemo } from 'react'
import type { Connector } from 'wagmi'

// Show every connector wagmi gives us — the first-party ones plus whatever EIP-6963 discovery finds
// installed in the browser. The only thing we collapse is the bare generic `injected` fallback (id
// exactly "injected"): once discovery has surfaced the real wallets behind it (each with its own id,
// name and icon), the unnamed catch-all is a duplicate, so it is dropped. When nothing is discovered
// (e.g. a plain mobile browser tab) it is kept, since it is then the only injected entry there is.
export function useVisibleConnectors(connectors: readonly Connector[]): Connector[] {
  return useMemo(() => {
    const hasDiscoveredInjected = connectors.some((c) => c.type === 'injected' && c.id !== 'injected')
    return connectors.filter((c) => !(hasDiscoveredInjected && c.type === 'injected' && c.id === 'injected'))
  }, [connectors])
}
