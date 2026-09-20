'use client'

import { USDC, arc } from '@covennetwork/sdk'
import { useCallback, useEffect, useState } from 'react'
import type { Address, WalletClient } from 'viem'
import { coven } from '@/lib/coven'
import {
  advance,
  clearPending,
  errorText,
  loadPending,
  savePending,
  stepsFor,
  type FlowKind,
  type PendingFlow,
  type Step,
} from '@/lib/flow'
import type { Asset } from '@/lib/assets'

export type FlowState = {
  kind: FlowKind
  steps: Step[]
  title: string
  detail?: string
  error?: string
  done: boolean
  hash?: `0x${string}`
}

export function useFlow(options: {
  wallet?: WalletClient
  address?: Address
  switchChain: (chainId: number) => Promise<unknown>
  onSettled: () => void
}) {
  const { wallet, address, switchChain, onSettled } = options
  const [flow, setFlow] = useState<FlowState>()
  const [resumable, setResumable] = useState<PendingFlow>()

  useEffect(() => {
    setResumable(loadPending())
  }, [])

  const update = useCallback((patch: Partial<FlowState>) => setFlow((current) => (current ? { ...current, ...patch } : current)), [])

  const finishDeposit = useCallback(
    async (pending: PendingFlow, steps: Step[]) => {
      let current = advance(steps, 'deliver', 'active')
      update({ steps: current, title: 'Delivering', detail: 'Circle is sending your USDC to Arc.' })
      await coven.bridge.waitForDelivery({ sourceChainId: pending.sourceChainId, hash: pending.hash })
      current = advance(current, 'deliver', 'done')
      update({ steps: current })
      if (!pending.swapAfter) {
        clearPending()
        update({ steps: current, title: 'Arrived', detail: 'Your USDC is on Arc.', done: true })
        return
      }
      if (!wallet || !address) {
        update({ steps: current, title: 'Almost there', detail: 'Connect your wallet on Arc to finish the swap.' })
        return
      }
      current = advance(current, 'swap', 'active')
      update({ steps: current, title: 'Swapping', detail: 'Pricing again, since the market moved while it travelled.' })
      const usdc = await coven.publicClient.readContract({
        address: USDC,
        abi: [
          {
            type: 'function',
            name: 'balanceOf',
            stateMutability: 'view',
            inputs: [{ type: 'address' }],
            outputs: [{ type: 'uint256' }],
          },
        ] as const,
        functionName: 'balanceOf',
        args: [address],
      })
      const result = await coven.swap({
        wallet,
        tokenIn: USDC,
        tokenOut: pending.swapAfter.tokenOut,
        amountIn: usdc,
        slippageBps: pending.swapAfter.slippageBps ?? 50,
      })
      clearPending()
      current = advance(current, 'swap', 'done')
      update({ steps: current, title: 'Done', detail: undefined, done: true, hash: result.hash })
    },
    [address, update, wallet],
  )

  const resume = useCallback(async () => {
    const pending = resumable ?? loadPending()
    if (!pending) return
    setResumable(undefined)
    const steps = stepsFor(pending.kind, Boolean(pending.swapAfter)).map((step) =>
      ['switch', 'approve', 'send'].includes(step.id) ? { ...step, state: 'done' as const } : step,
    )
    setFlow({ kind: pending.kind, steps, title: 'Picking up where you left off', done: false })
    try {
      await finishDeposit(pending, steps)
      onSettled()
    } catch (error) {
      update({ error: errorText(error), title: 'Could not finish' })
    }
  }, [finishDeposit, onSettled, resumable, update])

  const swap = useCallback(
    async (from: Asset, to: Asset, amountIn: bigint, slippageBps: number) => {
      if (!wallet || !address) return
      const steps = stepsFor('swap', false)
      setFlow({ kind: 'swap', steps, title: 'Swapping', done: false })
      try {
        update({ steps: advance(steps, 'approve', 'active'), detail: 'Approving the exact amount.' })
        const result = await coven.swap({
          wallet,
          tokenIn: from.token.address,
          tokenOut: to.token.address,
          amountIn,
          slippageBps,
        })
        update({
          steps: advance(advance(steps, 'approve', 'done'), 'swap', 'done'),
          title: 'Done',
          hash: result.hash,
          done: true,
        })
        onSettled()
      } catch (error) {
        update({ error: errorText(error), title: 'Swap failed', steps: advance(steps, 'swap', 'failed') })
      }
    },
    [address, onSettled, update, wallet],
  )

  const bridgeOut = useCallback(
    async (from: Asset, to: Asset, amountIn: bigint, slippageBps: number) => {
      if (!wallet || !address) return
      const steps = stepsFor('bridge-out', false)
      setFlow({ kind: 'bridge-out', steps, title: 'Sending', done: false })
      try {
        update({ steps: advance(steps, 'approve', 'active'), detail: 'Approving the exact amount.' })
        const result = await coven.bridge.fromArc({
          wallet,
          tokenIn: from.token.address,
          amountIn,
          destinationChainId: to.chainId,
          recipient: address,
          slippageBps,
        })
        let current = advance(advance(steps, 'approve', 'done'), 'send', 'done')
        savePending({
          kind: 'bridge-out',
          hash: result.hash,
          sourceChainId: arc.id,
          createdAt: Date.now(),
          note: `Sending USDC to ${to.chainName}`,
        })
        current = advance(current, 'deliver', 'active')
        update({ steps: current, title: 'Delivering', detail: `Circle is sending it to ${to.chainName}.`, hash: result.hash })
        await coven.bridge.waitForDelivery({ sourceChainId: arc.id, hash: result.hash })
        clearPending()
        update({ steps: advance(current, 'deliver', 'done'), title: 'Delivered', detail: `It is on ${to.chainName}.`, done: true })
        onSettled()
      } catch (error) {
        update({ error: errorText(error), title: 'Send failed' })
      }
    },
    [address, onSettled, update, wallet],
  )

  const deposit = useCallback(
    async (from: Asset, to: Asset, amount: bigint, slippageBps: number) => {
      if (!wallet || !address) return
      const swapAfter = to.remote || to.token.address.toLowerCase() === USDC.toLowerCase() ? undefined : { tokenOut: to.token.address, slippageBps }
      const steps = stepsFor('deposit', Boolean(swapAfter))
      setFlow({ kind: 'deposit', steps, title: 'Bringing USDC to Arc', done: false })
      try {
        update({ steps: advance(steps, 'switch', 'active'), detail: `Switch your wallet to ${from.chainName}.` })
        await switchChain(from.chainId)
        let current = advance(steps, 'switch', 'done')
        current = advance(current, 'approve', 'active')
        update({ steps: current, detail: 'Approving, then sending.' })
        const result = await coven.bridge.toArc({
          wallet,
          sourceChainId: from.chainId,
          amount,
          recipient: address,
        })
        current = advance(advance(current, 'approve', 'done'), 'send', 'done')
        const pending: PendingFlow = {
          kind: 'deposit',
          hash: result.hash,
          sourceChainId: from.chainId,
          createdAt: Date.now(),
          swapAfter,
          note: swapAfter ? `Buying ${to.token.symbol} with USDC from ${from.chainName}` : `Bringing USDC from ${from.chainName}`,
        }
        savePending(pending)
        update({ steps: current, hash: result.hash })
        await switchChain(arc.id).catch(() => undefined)
        await finishDeposit(pending, current)
        onSettled()
      } catch (error) {
        update({ error: errorText(error), title: 'Could not finish' })
      }
    },
    [address, finishDeposit, onSettled, switchChain, update, wallet],
  )

  return {
    flow,
    resumable,
    resume,
    swap,
    bridgeOut,
    deposit,
    dismiss: useCallback(() => setFlow(undefined), []),
    discard: useCallback(() => {
      clearPending()
      setResumable(undefined)
    }, []),
  }
}
