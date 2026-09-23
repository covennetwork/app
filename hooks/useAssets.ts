'use client'

import { USDC, arc, type Pool, type Token } from '@covennetwork/sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, erc20Abi, http, type Address } from 'viem'
import * as chains from 'viem/chains'
import { REMOTE_CHAINS, arcAsset, remoteAssets, sortAssets, type Asset } from '@/lib/assets'
import { useCoven } from '@/lib/covenContext'

const chainById = (id: number) => Object.values(chains).find((c) => typeof c === 'object' && 'id' in c && c.id === id)

// `enabled` lets a locked widget skip pool discovery and balance fetching entirely — it only
// ever touches its two pool tokens, so running the discovery watcher there would add pointless
// eth_getLogs load to the shared (often rate-limited) Arc RPC.
export function useAssets(address?: Address, enabled = true) {
  const coven = useCoven()
  const [tokens, setTokens] = useState<Token[]>(() => coven.tokens.list())
  const [newAddresses, setNewAddresses] = useState<Set<string>>(new Set())
  const [arcBalances, setArcBalances] = useState<Record<string, bigint>>({})
  const [remoteBalances, setRemoteBalances] = useState<Record<number, bigint | undefined>>({})
  const seen = useRef(new Set<string>())

  useEffect(() => {
    if (!enabled) return
    coven.tokens
      .loadCoinGecko()
      .catch(() => undefined)
      .finally(() => setTokens(coven.tokens.list()))
    // Defer the watcher one tick so React's StrictMode/HMR remount cancels the throwaway first
    // pass before it starts. Two concurrent watchers double the eth_getLogs load and trip the
    // public Arc RPC's rate limit, which kills discovery and leaves every swap with "No route".
    let stop = () => {}
    const timer = setTimeout(() => {
      stop = coven.pools.watch({
        onPools: (pools: Pool[], phase) => {
          setTokens(coven.tokens.list())
          if (phase !== 'live') {
            for (const pool of pools) {
              seen.current.add(pool.token0.toLowerCase())
              seen.current.add(pool.token1.toLowerCase())
            }
            return
          }
          const fresh: string[] = []
          for (const pool of pools) {
            for (const token of [pool.token0, pool.token1]) {
              const key = token.toLowerCase()
              if (key !== USDC.toLowerCase() && !seen.current.has(key)) {
                seen.current.add(key)
                fresh.push(key)
              }
            }
          }
          if (fresh.length > 0) setNewAddresses((current) => new Set([...current, ...fresh]))
        },
        onError: () => undefined,
      })
    }, 0)
    return () => {
      clearTimeout(timer)
      stop()
    }
  }, [coven, enabled])

  const refreshArcBalances = useCallback(async () => {
    if (!address) return setArcBalances({})
    const list = coven.tokens.list()
    const results = await coven.publicClient.multicall({
      allowFailure: true,
      contracts: list.map((token) => ({
        address: token.address,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [address] as const,
      })),
    })
    const next: Record<string, bigint> = {}
    results.forEach((result, index) => {
      const token = list[index]
      if (token && result.status === 'success' && (result.result as bigint) > 0n) {
        next[token.address.toLowerCase()] = result.result as bigint
      }
    })
    setArcBalances(next)
  }, [address, coven])

  const refreshRemoteBalances = useCallback(async () => {
    if (!address) return setRemoteBalances({})
    const entries = await Promise.all(
      REMOTE_CHAINS.map(async (chain) => {
        const definition = chainById(chain.chainId)
        if (!definition) return [chain.chainId, undefined] as const
        try {
          const client = createPublicClient({ chain: definition, transport: http() })
          const balance = await client.readContract({
            address: chain.usdc,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address],
          })
          return [chain.chainId, balance] as const
        } catch {
          return [chain.chainId, undefined] as const
        }
      }),
    )
    setRemoteBalances(Object.fromEntries(entries))
  }, [address])

  useEffect(() => {
    if (!enabled) return
    void refreshArcBalances()
    void refreshRemoteBalances()
  }, [enabled, refreshArcBalances, refreshRemoteBalances])

  const assets = useMemo(() => {
    const usdcToken = tokens.find((t) => t.address.toLowerCase() === USDC.toLowerCase())
    const onArc = tokens.map((token) =>
      arcAsset(token, arcBalances[token.address.toLowerCase()], newAddresses.has(token.address.toLowerCase())),
    )
    const remote = usdcToken ? remoteAssets(usdcToken, remoteBalances) : []
    return sortAssets([...onArc, ...remote])
  }, [tokens, arcBalances, remoteBalances, newAddresses])

  return {
    assets,
    count: tokens.length,
    newCount: newAddresses.size,
    arcBalances,
    remoteBalances,
    refresh: useCallback(() => {
      void refreshArcBalances()
      void refreshRemoteBalances()
    }, [refreshArcBalances, refreshRemoteBalances]),
    chainName: (id: number) => (id === arc.id ? 'Arc' : (chainById(id)?.name ?? `Chain ${id}`)),
  }
}
