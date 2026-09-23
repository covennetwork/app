import type { Integrator, PoolKey } from '@covennetwork/sdk'
import { type Address, type Hex, isAddress } from 'viem'

// A pool an integrator has locked the widget to. `token0`/`token1` fix the pair the user can
// swap; `key` is the full Uniswap pool key, present only when the integrator supplied every
// field, and is passed to the router as `extraPools` so the quote routes through that pool.
export type WidgetPool = {
  token0: Address
  token1: Address
  key?: PoolKey
}

export type WidgetConfig = {
  integrator?: Integrator
  slippageBps: number
  bg: string
  /** Pool the integrator spelled out in full (both tokens given). Used as-is, no lookup. */
  pool?: WidgetPool
  /** A single pool identifier (v3 address or v4 id) to resolve into the pair at runtime. */
  poolRef?: Hex
}

const address = (value: string | null): Address | undefined =>
  value && isAddress(value) ? (value as Address) : undefined

const int = (value: string | null): number | undefined => {
  if (value === null || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : undefined
}

// A color safe to drop into `background`: a hex code, or the keyword `transparent`. Anything
// else (including attempts to smuggle CSS) falls back to the brand paper color.
const color = (value: string | null): string => {
  if (!value) return '#EFECE4'
  const v = value.trim()
  if (v.toLowerCase() === 'transparent') return 'transparent'
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ? v : '#EFECE4'
}

export function parseWidgetConfig(params: URLSearchParams): WidgetConfig {
  const integratorAddress = address(params.get('integrator'))
  const integrator: Integrator | undefined = integratorAddress
    ? { address: integratorAddress, feeBps: Math.max(0, int(params.get('integratorFee')) ?? 0) }
    : undefined

  const slippageBps = Math.min(Math.max(int(params.get('slippage')) ?? 50, 0), 9999)

  const token0 = address(params.get('token0'))
  const token1 = address(params.get('token1'))
  let pool: WidgetPool | undefined
  if (token0 && token1 && token0.toLowerCase() !== token1.toLowerCase()) {
    const poolFee = int(params.get('poolFee'))
    const tickSpacing = int(params.get('tickSpacing'))
    const hooks = address(params.get('hooks'))
    // A pool key only routes if it is complete. Partial pool params still lock the pair, but
    // routing falls back to whatever the router already knows about it.
    const key: PoolKey | undefined =
      poolFee !== undefined && tickSpacing !== undefined
        ? sortedPoolKey(token0, token1, poolFee, tickSpacing, hooks ?? ('0x0000000000000000000000000000000000000000' as Address))
        : undefined
    pool = { token0, token1, key }
  }

  // A single `pool` identifier is resolved at runtime, but only when the pair wasn't already
  // spelled out. A 0x-prefixed hex value covers both a v3 pool address and a v4 pool id.
  const poolParam = params.get('pool')?.trim()
  const poolRef = !pool && poolParam && /^0x[0-9a-fA-F]+$/.test(poolParam) ? (poolParam as Hex) : undefined

  return { integrator, slippageBps, bg: color(params.get('bg')), pool, poolRef }
}

// A Uniswap pool key requires currency0 < currency1 by address. Integrators pass the pair in
// display order (pay/receive); this normalizes it for the key without disturbing that order.
function sortedPoolKey(a: Address, b: Address, fee: number, tickSpacing: number, hooks: Address): PoolKey {
  const [currency0, currency1] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]
  return { currency0, currency1, fee, tickSpacing, hooks }
}
