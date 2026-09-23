'use client'

import { useCallback, useEffect, useState } from 'react'
import { type Address, erc20Abi } from 'viem'
import { arcAsset, type Asset } from '@/lib/assets'
import { useCoven } from '@/lib/covenContext'

// Resolves the two tokens of a locked pool into full Assets with live balances. Unlike
// useAssets it does no pool discovery, CoinGecko load, or remote-chain balance fetching — a
// locked widget only ever touches these two Arc tokens, so it stays fast and quiet on the RPC.
export function useWidgetPair(token0: Address, token1: Address, address?: Address) {
  const coven = useCoven()
  const [assets, setAssets] = useState<[Asset, Asset]>()
  const [balances, setBalances] = useState<Record<string, bigint>>({})

  useEffect(() => {
    let active = true
    void (async () => {
      const [a, b] = await Promise.all([coven.tokens.resolve(token0), coven.tokens.resolve(token1)])
      if (active) setAssets([arcAsset(a), arcAsset(b)])
    })()
    return () => {
      active = false
    }
  }, [coven, token0, token1])

  const refresh = useCallback(async () => {
    if (!address) return setBalances({})
    const results = await coven.publicClient.multicall({
      allowFailure: true,
      contracts: [token0, token1].map((token) => ({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [address] as const,
      })),
    })
    const next: Record<string, bigint> = {}
    ;[token0, token1].forEach((token, index) => {
      const result = results[index]
      if (result?.status === 'success') next[token.toLowerCase()] = result.result as bigint
    })
    setBalances(next)
  }, [address, coven, token0, token1])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const withBalance = (asset: Asset): Asset => ({ ...asset, balance: balances[asset.token.address.toLowerCase()] })
  const pair = assets ? ([withBalance(assets[0]), withBalance(assets[1])] as [Asset, Asset]) : undefined

  return { pair, refresh }
}
