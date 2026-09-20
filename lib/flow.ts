'use client'

import { CovenError, arc } from '@covennetwork/sdk'
import type { Address, Hash } from 'viem'

export type StepId = 'switch' | 'approve' | 'send' | 'deliver' | 'swap'

export type Step = {
  id: StepId
  label: string
  state: 'waiting' | 'active' | 'done' | 'failed'
}

export type FlowKind = 'swap' | 'bridge-out' | 'deposit'

export type PendingFlow = {
  kind: FlowKind
  hash: Hash
  sourceChainId: number
  createdAt: number
  swapAfter?: { tokenOut: Address; slippageBps?: number }
  note: string
}

const STORAGE_KEY = 'coven.pending-flow'

export const stepsFor = (kind: FlowKind, swapAfter: boolean): Step[] => {
  const waiting = (id: StepId, label: string): Step => ({ id, label, state: 'waiting' })
  if (kind === 'swap') return [waiting('approve', 'Approve'), waiting('swap', 'Swap')]
  if (kind === 'bridge-out') return [waiting('approve', 'Approve'), waiting('send', 'Swap and send'), waiting('deliver', 'Deliver')]
  return [
    waiting('switch', 'Switch network'),
    waiting('approve', 'Approve'),
    waiting('send', 'Send'),
    waiting('deliver', 'Deliver to Arc'),
    ...(swapAfter ? [waiting('swap', 'Swap on Arc')] : []),
  ]
}

export const advance = (steps: Step[], id: StepId, state: Step['state']): Step[] =>
  steps.map((step) => (step.id === id ? { ...step, state } : step))

export function savePending(flow: PendingFlow) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(flow))
  } catch {
    // storage is unavailable in private windows; the flow still works while the tab stays open
  }
}

export function loadPending(): PendingFlow | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const flow = JSON.parse(raw) as PendingFlow
    if (!flow.hash || Date.now() - flow.createdAt > 6 * 60 * 60 * 1000) return undefined
    return flow
  } catch {
    return undefined
  }
}

export function clearPending() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to clean up
  }
}

export const isArc = (chainId?: number) => chainId === arc.id

export const errorText = (error: unknown) => {
  if (error instanceof CovenError) return error.message
  if (error instanceof Error) {
    const first = error.message.split('\n')[0] ?? ''
    if (/User rejected|denied transaction/i.test(first)) return 'You cancelled that in your wallet.'
    return first || 'Something went wrong.'
  }
  return 'Something went wrong.'
}
