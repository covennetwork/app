import { arc } from '@covennetwork/sdk'
import { http, createConfig } from 'wagmi'
import { arbitrum, base, mainnet, optimism, polygon } from 'wagmi/chains'
import { coinbaseWallet, injected, metaMask, safe, walletConnect } from 'wagmi/connectors'

export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? ''
export const arcRpcUrl = process.env.NEXT_PUBLIC_ARC_RPC_URL

// WalletConnect cannot initialise without a project id — there is no shared or default one. When it
// is missing the connector is simply left out (registering it anyway throws at runtime), so make the
// reason loud instead of shipping a wallet list that is silently missing its most important entry.
if (!projectId && typeof window !== 'undefined') {
  console.error(
    '[coven] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set — the WalletConnect connector is disabled, ' +
      'so mobile wallets and QR sign-in will not appear. Get a free id at https://cloud.reown.com and add ' +
      'it to app/.env.local (NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...), then rebuild.',
  )
}

export const wagmiConfig = createConfig({
  chains: [arc, mainnet, base, arbitrum, optimism, polygon],
  // EIP-6963: every wallet the browser exposes (MetaMask, Rainbow, Rabby, Brave, Zerion, and any
  // other extension, official or not) is discovered and added as its own connector automatically.
  multiInjectedProviderDiscovery: true,
  connectors: [
    // First-party connectors. The discovery above covers installed extensions; these add the ones
    // that need their own SDK — mobile deep-linking, smart accounts, QR — which discovery cannot.
    injected(),
    metaMask(),
    coinbaseWallet({ appName: 'Coven', preference: { options: 'all' } }),
    safe(),
    ...(projectId ? [walletConnect({ projectId, showQrModal: false })] : []),
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
