import { createCoven, MAX_INTEGRATOR_FEE_BPS, type Coven, type CovenConfig, type Integrator } from '@covennetwork/sdk'
import { http } from 'viem'
import { arcRpcUrl } from './wagmi'

// In the browser `fetch` must be called with `window` as its receiver; passing the bare
// reference lets the SDK invoke it as `ctx.fetch(...)` (wrong receiver → "Illegal invocation").
const browserFetch: NonNullable<CovenConfig['fetch']> = (input, init) => fetch(input, init)

// A Coven client for a given integrator. The app uses one built from the environment; the
// embeddable widget builds one per request from the integrator's own address, so the fee it
// earns is set at runtime rather than baked in at build time.
export function createCovenClient(integrator?: Integrator): Coven {
  const feeBps = integrator ? Math.max(0, Math.min(integrator.feeBps || 0, MAX_INTEGRATOR_FEE_BPS)) : 0
  return createCoven({
    fetch: browserFetch,
    ...(arcRpcUrl ? { arcTransport: http(arcRpcUrl) } : {}),
    ...(integrator?.address ? { integrator: { address: integrator.address, feeBps } } : {}),
  })
}

const integratorAddress = process.env.NEXT_PUBLIC_INTEGRATOR_ADDRESS as `0x${string}` | undefined
const integratorFeeBps = Number(process.env.NEXT_PUBLIC_INTEGRATOR_FEE_BPS ?? '0')

export const coven = createCovenClient(
  integratorAddress ? { address: integratorAddress, feeBps: integratorFeeBps } : undefined,
)
