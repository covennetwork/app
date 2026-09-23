import { arc } from '@covennetwork/sdk'
import { http, createConfig } from 'wagmi'
import { arbitrum, base, mainnet, optimism, polygon } from 'wagmi/chains'
import { coinbaseWallet, injected, safe, walletConnect } from 'wagmi/connectors'

export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? ''
export const arcRpcUrl = process.env.NEXT_PUBLIC_ARC_RPC_URL

export const wagmiConfig = createConfig({
  chains: [arc, mainnet, base, arbitrum, optimism, polygon],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Coven', preference: { options: 'all' } }),
    ...(projectId ? [walletConnect({ projectId, showQrModal: false })] : []),
    safe(),
  ],
  transports: {
    [arc.id]: http(arcRpcUrl),
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
