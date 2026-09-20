import { createCoven } from '@covennetwork/sdk'
import { http } from 'viem'
import { arcRpcUrl } from './wagmi'

const integratorAddress = process.env.NEXT_PUBLIC_INTEGRATOR_ADDRESS as `0x${string}` | undefined
const integratorFeeBps = Number(process.env.NEXT_PUBLIC_INTEGRATOR_FEE_BPS ?? '0')

export const coven = createCoven({
  ...(arcRpcUrl ? { arcTransport: http(arcRpcUrl) } : {}),
  ...(integratorAddress ? { integrator: { address: integratorAddress, feeBps: integratorFeeBps } } : {}),
})
