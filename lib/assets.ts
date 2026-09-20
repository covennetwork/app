import { CCTP_CHAINS, USDC, arc, type Token } from '@covennetwork/sdk'
import type { Address } from 'viem'

export type Asset = {
  key: string
  token: Token
  chainId: number
  chainName: string
  remote: boolean
  balance?: bigint
  isNew?: boolean
}

export const REMOTE_CHAINS = CCTP_CHAINS.map((c) => ({
  chainId: c.chain.id,
  name: c.chain.name,
  usdc: c.usdc as Address,
  gasless: c.gasless,
}))

export const assetKey = (address: string, chainId: number) => `${chainId}:${address.toLowerCase()}`

export function arcAsset(token: Token, balance?: bigint, isNew?: boolean): Asset {
  return {
    key: assetKey(token.address, arc.id),
    token,
    chainId: arc.id,
    chainName: 'Arc',
    remote: false,
    balance,
    isNew,
  }
}

export function remoteAssets(usdcToken: Token, balances: Record<number, bigint | undefined>): Asset[] {
  return REMOTE_CHAINS.map((chain) => ({
    key: assetKey(chain.usdc, chain.chainId),
    token: { ...usdcToken, address: chain.usdc },
    chainId: chain.chainId,
    chainName: chain.name,
    remote: true,
    balance: balances[chain.chainId],
  }))
}

export const isUsdc = (asset: Asset) => asset.token.address.toLowerCase() === USDC.toLowerCase() || asset.remote

export function assetLabel(asset: Asset) {
  return asset.remote ? `${asset.token.symbol} on ${asset.chainName}` : asset.token.symbol
}

export function sortAssets(assets: Asset[]) {
  const rank = (a: Asset) => {
    if (a.balance && a.balance > 0n) return 0
    if (a.isNew) return 1
    if (a.remote) return 3
    return 2
  }
  return [...assets].sort((a, b) => rank(a) - rank(b))
}
