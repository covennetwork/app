'use client'

import { USDC, arc, type PoolKey, type Quote } from '@covennetwork/sdk'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Connector } from 'wagmi'
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi'
import { AssetPicker } from '@/components/AssetPicker'
import { ConnectView, ConnectingView, WalletConnectView } from '@/components/Connect'
import { Ladder } from '@/components/Ladder'
import { Action, Label, Note, Row, Slot, Title } from '@/components/Ui'
import { useAssets } from '@/hooks/useAssets'
import { useFlow } from '@/hooks/useFlow'
import { useResolvedPool } from '@/hooks/useResolvedPool'
import { useWidgetPair } from '@/hooks/useWidgetPair'
import { assetLabel, type Asset } from '@/lib/assets'
import { CovenProvider, useCoven } from '@/lib/covenContext'
import { errorText } from '@/lib/flow'
import { formatUnitsCompact, parseAmount, shortAddress } from '@/lib/format'
import { parseWidgetConfig, type WidgetConfig } from '@/lib/widgetConfig'

type View = 'connect' | 'connecting' | 'walletconnect' | 'network' | 'home' | 'pick-from' | 'pick-to' | 'review' | 'status'

const GAS_RESERVE = 500_000n
const CONNECT_TIMEOUT_MS = 60_000

export default function WidgetPage() {
  return (
    <Suspense fallback={null}>
      <WidgetRoot />
    </Suspense>
  )
}

// useSearchParams must sit under Suspense in the app router, and rendering the boundary's
// fallback on the server (rather than reading window.location) keeps hydration consistent. The
// config is stable for the life of the embed, so it is parsed once per param change.
function WidgetRoot() {
  const params = useSearchParams()
  const config = useMemo<WidgetConfig>(() => parseWidgetConfig(new URLSearchParams(params.toString())), [params])
  // The widget is wallet-only and configured entirely from the URL, so there is nothing useful
  // to server-render. Rendering after mount keeps the server output (null) and the first client
  // render identical, avoiding a hydration mismatch on the param-driven background.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <CovenProvider integrator={config.integrator}>
      <Frame bg={config.bg}>
        <Widget config={config} />
      </Frame>
    </CovenProvider>
  )
}

// The widget paints its own surface and reports its height to the host page so the embedding
// iframe can size itself. Everything lives in one column that fits a narrow embed.
function Frame({ bg, children }: { bg: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // Embedded in an iframe the container must size to its content so the host can grow the iframe
  // to fit (a viewport-tied min-height would just report the iframe's current height forever).
  // Opened directly it fills the screen and centers like the main app.
  const embedded = typeof window !== 'undefined' && window.parent !== window
  useEffect(() => {
    if (!embedded) return
    const post = () => {
      const height = ref.current?.offsetHeight ?? document.documentElement.scrollHeight
      window.parent.postMessage({ type: 'coven:resize', height }, '*')
    }
    post()
    const observer = new ResizeObserver(post)
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [embedded])
  return (
    <div
      ref={ref}
      style={{ background: bg }}
      className={`flex w-full items-center justify-center px-5 py-8 ${embedded ? 'min-h-[480px]' : 'min-h-dvh'}`}
    >
      <section className="view-enter w-full max-w-md">{children}</section>
    </div>
  )
}

function Widget({ config }: { config: WidgetConfig }) {
  const coven = useCoven()
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient()

  const [view, setView] = useState<View>('connect')
  const [connecting, setConnecting] = useState<Connector>()
  const [connectError, setConnectError] = useState<string>()
  const [uri, setUri] = useState<string>()
  const [flip, setFlip] = useState(false)
  const [fromKey, setFromKey] = useState<string>()
  const [toKey, setToKey] = useState<string>()
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<Quote>()
  const [quoteNote, setQuoteNote] = useState<string>()
  const [quoting, setQuoting] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const connectAttempt = useRef(0)

  // A locked widget is either a fully-specified pool or a single identifier resolved at runtime.
  const locked = Boolean(config.pool || config.poolRef)
  const resolved = useResolvedPool(config.poolRef)
  const pool = config.pool ?? resolved.pool
  const extraPools = useMemo<PoolKey[] | undefined>(() => (pool?.key ? [pool.key] : undefined), [pool])

  // Locked pools resolve just their two tokens; open widgets use the full Arc asset set. The
  // asset watcher is disabled when locked so it adds no discovery load.
  const pairHook = useWidgetPair(pool?.token0 ?? USDC, pool?.token1 ?? USDC, pool ? address : undefined)
  const assetsHook = useAssets(locked ? undefined : address, !locked)
  const arcAssets = useMemo(
    () => (locked ? [] : assetsHook.assets.filter((asset) => !asset.remote)),
    [assetsHook.assets, locked],
  )
  const refresh = locked ? pairHook.refresh : assetsHook.refresh

  const { from, to } = useMemo(() => {
    if (pool && pairHook.pair) {
      const [a, b] = pairHook.pair
      return flip ? { from: b, to: a } : { from: a, to: b }
    }
    return {
      from: arcAssets.find((asset) => asset.key === fromKey),
      to: arcAssets.find((asset) => asset.key === toKey),
    }
  }, [arcAssets, flip, fromKey, pool, pairHook.pair, toKey])

  const amountIn = useMemo(() => (from ? parseAmount(amount, from.token.decimals) : 0n), [amount, from])

  const { flow, swap, dismiss } = useFlow({
    wallet: walletClient,
    address,
    switchChain: (id) => switchChainAsync({ chainId: id }),
    onSettled: () => void refresh(),
  })

  // Open widgets default the pay token to USDC on Arc, matching the main app.
  useEffect(() => {
    if (locked || fromKey || arcAssets.length === 0) return
    const usdc = arcAssets.find((asset) => asset.token.address.toLowerCase() === USDC.toLowerCase())
    setFromKey(usdc?.key ?? arcAssets[0]?.key)
  }, [arcAssets, fromKey, locked])

  useEffect(() => {
    if (!isConnected) return setView('connect')
    setView((current) => (current === 'connect' || current === 'connecting' || current === 'walletconnect' ? 'home' : current))
  }, [isConnected])

  useEffect(() => {
    if (flow) setView('status')
  }, [flow])

  // Price the swap. Both sides are always Arc tokens here, so it is a plain quote, routed
  // through the locked pool when the integrator gave a full pool key.
  useEffect(() => {
    setQuote(undefined)
    setQuoteNote(undefined)
    if (!from || !to || amountIn <= 0n) return
    setQuoting(true)
    const timer = setTimeout(() => {
      coven
        .quote({ tokenIn: from.token.address, tokenOut: to.token.address, amountIn, extraPools })
        .then(setQuote)
        .catch((error: unknown) => setQuoteNote(errorText(error)))
        .finally(() => setQuoting(false))
    }, 320)
    return () => clearTimeout(timer)
  }, [amountIn, coven, extraPools, from, to])

  const connect = useCallback(
    async (connector: Connector) => {
      const attempt = ++connectAttempt.current
      const current = () => connectAttempt.current === attempt
      setUri(undefined)
      setConnectError(undefined)
      setConnecting(connector)
      setView('connecting')
      const timer = setTimeout(() => {
        if (!current()) return
        setConnectError('Your wallet didn’t respond. It may have been dismissed — try again.')
        setView('connecting')
      }, CONNECT_TIMEOUT_MS)
      try {
        if (connector.type === 'walletConnect') {
          connector.emitter.on('message', ({ type, data }) => {
            if (type === 'display_uri' && typeof data === 'string' && current()) {
              setUri(data)
              setView('walletconnect')
            }
          })
        }
        await connectAsync({ connector })
        if (!current()) return
        clearTimeout(timer)
        setConnecting(undefined)
        setView('home')
      } catch (error) {
        if (!current()) return
        clearTimeout(timer)
        setConnectError(errorText(error))
        setView('connecting')
      }
    },
    [connectAsync],
  )

  // The Safe connector only has a provider inside the Safe{Wallet} app; a generic embed iframe
  // is not one, so it is always hidden here.
  const visibleConnectors = useMemo(() => connectors.filter((connector) => connector.type !== 'safe'), [connectors])

  const start = useCallback(() => {
    if (!from || !to || amountIn <= 0n) return
    void swap(from, to, amountIn, config.slippageBps, extraPools)
  }, [amountIn, config.slippageBps, extraPools, from, swap, to])

  const outcome = quote && to ? `${formatUnitsCompact(quote.amountOut, to.token.decimals)} ${to.token.symbol}` : undefined
  const ready = Boolean(from && to && amountIn > 0n && quote)
  const feeLine = (q: Quote) =>
    `Fee ${formatUnitsCompact(q.platformFee + q.integratorFee, coven.tokens.get(q.feeToken)?.decimals ?? 6)} ${
      coven.tokens.get(q.feeToken)?.symbol ?? ''
    }, route ${q.hops.map((hop) => hop.protocol).join(' → ')}`

  if (view === 'connect') {
    return <ConnectView connectors={visibleConnectors} onConnect={(connector) => void connect(connector)} />
  }

  if (view === 'connecting') {
    return (
      <ConnectingView
        connectorName={connecting?.name ?? 'wallet'}
        error={connectError}
        onRetry={() => connecting && void connect(connecting)}
        onBack={() => {
          setConnecting(undefined)
          setConnectError(undefined)
          setView('connect')
        }}
      />
    )
  }

  if (view === 'walletconnect') {
    return <WalletConnectView uri={uri} onBack={() => setView('connect')} />
  }

  if (isConnected && chainId !== arc.id && view !== 'status') {
    return (
      <>
        <Label>Network</Label>
        <Title>Switch to Arc.</Title>
        <div className="mt-10 space-y-4">
          <Action onClick={() => void switchChainAsync({ chainId: arc.id }).catch(() => undefined)}>Switch</Action>
          <Action tone="ghost" onClick={() => disconnect()}>
            Disconnect
          </Action>
        </div>
      </>
    )
  }

  if ((view === 'pick-from' || view === 'pick-to') && !locked) {
    const pickingFrom = view === 'pick-from'
    return (
      <AssetPicker
        assets={arcAssets}
        title={pickingFrom ? 'You pay with' : 'You receive'}
        initialKey={pickingFrom ? fromKey : toKey}
        onConfirm={(asset: Asset) => {
          if (pickingFrom) setFromKey(asset.key)
          else setToKey(asset.key)
          setView('home')
        }}
        onCancel={() => setView('home')}
      />
    )
  }

  if (view === 'review' && from && to) {
    return (
      <>
        <Label>Review</Label>
        <Title>{outcome ?? `${amount} ${assetLabel(from)}`}</Title>
        <div className="mt-10 space-y-4 text-base tracking-tight text-black/45">
          <Row>
            <span>You pay</span>
            <span className="text-black">
              {amount} {from.token.symbol}
            </span>
          </Row>
          {quote && (
            <>
              <Row>
                <span>Fee</span>
                <span className="text-black">
                  {formatUnitsCompact(
                    quote.platformFee + quote.integratorFee,
                    coven.tokens.get(quote.feeToken)?.decimals ?? 6,
                  )}{' '}
                  {coven.tokens.get(quote.feeToken)?.symbol ?? ''}
                </span>
              </Row>
              <Row>
                <span>Route</span>
                <span className="text-black">{quote.hops.map((hop) => hop.protocol).join(' → ')}</span>
              </Row>
            </>
          )}
          <Row>
            <span>Max slippage</span>
            <span className="text-black">{(config.slippageBps / 100).toFixed(2)}%</span>
          </Row>
        </div>
        <div className="mt-10 space-y-4">
          <Action onClick={start}>Confirm</Action>
          <Action tone="ghost" onClick={() => setView('home')}>
            Back
          </Action>
        </div>
      </>
    )
  }

  if (view === 'status' && flow) {
    return (
      <>
        <Label>{flow.error ? 'Failed' : flow.done ? 'Done' : 'Working'}</Label>
        <Title>{flow.error ?? flow.title}</Title>
        <Ladder steps={flow.steps} />
        <div className="mt-8 space-y-4">
          {flow.detail && !flow.error && <Note>{flow.detail}</Note>}
          {flow.hash && (
            <Note>
              <a
                className="tap underline decoration-black/25 underline-offset-4"
                href={`https://explorer.arc.io/tx/${flow.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddress(flow.hash)}
              </a>
            </Note>
          )}
        </div>
        <div className="mt-10">
          <Action
            disabled={!flow.done && !flow.error}
            onClick={() => {
              dismiss()
              setAmount('')
              setView('home')
            }}
          >
            {flow.done || flow.error ? 'Back' : 'Please wait'}
          </Action>
        </div>
      </>
    )
  }

  // A single-identifier pool still resolving (or that couldn't be found) — hold the home view.
  if (locked && !pool) {
    return (
      <>
        <Label>Pool</Label>
        <Title>{resolved.error ? 'Pool not found.' : 'Loading pool…'}</Title>
        <div className="mt-10">
          <Note>{resolved.error ?? 'Fetching the pool’s tokens.'}</Note>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <Label>Coven</Label>
        <button type="button" className="tap" onClick={() => disconnect()}>
          <Label>{address ? shortAddress(address) : ''}</Label>
        </button>
      </div>

      <div className="mt-5">
        <Title>
          <span className="block">
            <span className="text-black/35">Pay </span>
            <input
              ref={amountRef}
              inputMode="decimal"
              value={amount}
              placeholder="0"
              aria-label="Amount"
              size={Math.max(amount.length, 1)}
              onChange={(event) => {
                const next = event.target.value.replace(/[^0-9.]/g, '')
                if ((next.match(/\./g)?.length ?? 0) <= 1) setAmount(next)
              }}
              className="bg-transparent text-black caret-black outline-none placeholder:text-black/20"
            />{' '}
            {locked ? (
              <span className="text-black">{from ? from.token.symbol : '…'}</span>
            ) : (
              <Slot onClick={() => setView('pick-from')}>{from ? assetLabel(from) : '…'}</Slot>
            )}
          </span>
          <span className="block">
            <span className="text-black/35">get </span>
            {locked ? (
              <span className="text-black">{outcome ?? (to ? to.token.symbol : '…')}</span>
            ) : (
              <Slot onClick={() => setView('pick-to')} muted={!to}>
                {outcome ?? (to ? assetLabel(to) : 'something')}
              </Slot>
            )}
          </span>
        </Title>
      </div>

      <div className="mt-8 space-y-4">
        {locked && (
          <Action tone="ghost" onClick={() => setFlip((value) => !value)}>
            Flip direction
          </Action>
        )}
        {from?.balance !== undefined && (
          <Action
            tone="ghost"
            onClick={() => {
              const keepsGas = from.token.address.toLowerCase() === USDC.toLowerCase()
              const reserve = keepsGas ? GAS_RESERVE : 0n
              const balance = from.balance ?? 0n
              const usable = balance > reserve ? balance - reserve : 0n
              setAmount(formatUnitsCompact(usable, from.token.decimals, from.token.decimals).replace(/,/g, ''))
              amountRef.current?.focus()
            }}
          >
            Max {formatUnitsCompact(from.balance, from.token.decimals)} {from.token.symbol}
            {from.token.address.toLowerCase() === USDC.toLowerCase() ? ', keeping gas' : ''}
          </Action>
        )}
        <Note>
          {quoting ? 'Pricing…' : (quoteNote ?? (quote ? feeLine(quote) : 'Type an amount to see the price.'))}
        </Note>
        <Action disabled={!ready} onClick={() => setView('review')}>
          Review
        </Action>
      </div>
    </>
  )
}
