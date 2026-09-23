'use client'

import type { Pool } from '@covennetwork/sdk'
import { useEffect, useState } from 'react'
import { type Address, type Hex, isAddress } from 'viem'
import { useCoven } from '@/lib/covenContext'
import type { WidgetPool } from '@/lib/widgetConfig'

// Minimal Uniswap v3 pool ABI — enough to read the pair straight off a pool address without
// touching discovery. The SDK's own v3 ABI only carries `liquidity`, so these live here.
const v3PoolAbi = [
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const RESOLVE_TIMEOUT_MS = 20_000

export type ResolvedPool = { pool?: WidgetPool; loading: boolean; error?: string }

// Resolves a single pool identifier into the pair (and, for v4, the full pool key). A v3 pool is
// a contract address, so its tokens are read directly. A v4 pool id is a hash of its key that
// can't be reversed, so it is matched against pool discovery, which carries the key.
export function useResolvedPool(ref?: Hex): ResolvedPool {
  const coven = useCoven()
  const [state, setState] = useState<ResolvedPool>({ loading: Boolean(ref) })

  useEffect(() => {
    if (!ref) return setState({ loading: false })
    setState({ loading: true })
    let active = true
    let stop = () => {}

    void (async () => {
      // Fast path: treat the id as a v3 pool address and read its tokens.
      if (isAddress(ref)) {
        try {
          const [t0, t1] = await coven.publicClient.multicall({
            allowFailure: false,
            contracts: [
              { address: ref as Address, abi: v3PoolAbi, functionName: 'token0' },
              { address: ref as Address, abi: v3PoolAbi, functionName: 'token1' },
            ],
          })
          if (!active) return
          setState({ loading: false, pool: { token0: t0 as Address, token1: t1 as Address } })
          return
        } catch {
          // Not a readable v3 pool — fall through to discovery (it may be a v4 id).
        }
      }

      // Discovery path: watch for the pool whose id matches, then lift its pair and key.
      const target = ref.toLowerCase()
      const timer = setTimeout(() => {
        if (!active) return
        setState({
          loading: false,
          error: 'Could not find that pool. Pass the token pair explicitly, or check the pool id.',
        })
        stop()
      }, RESOLVE_TIMEOUT_MS)

      stop = coven.pools.watch({
        onPools: (pools: Pool[]) => {
          const match = pools.find((pool) => pool.id.toLowerCase() === target)
          if (!match || !active) return
          clearTimeout(timer)
          setState({ loading: false, pool: { token0: match.token0, token1: match.token1, key: match.key } })
          stop()
        },
        onError: () => undefined,
      })
    })()

    return () => {
      active = false
      stop()
    }
  }, [coven, ref])

  return state
}
