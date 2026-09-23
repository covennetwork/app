'use client'

import { USDC, arc, type Quote } from '@covennetwork/sdk'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Connector } from 'wagmi'
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi'
import { AssetPicker } from '@/components/AssetPicker'
import { ConnectView, ConnectingView, WalletConnectView } from '@/components/Connect'
import CountUp from '@/components/CountUp'
import { Ladder } from '@/components/Ladder'
import { Action, Card, Label, Nav, Note, Row, Slot, Title } from '@/components/Ui'
import { useAssets } from '@/hooks/useAssets'
import { useFlow } from '@/hooks/useFlow'
import { assetLabel, type Asset } from '@/lib/assets'
import { useCoven } from '@/lib/covenContext'
import { errorText } from '@/lib/flow'
import { formatUnitsCompact, parseAmount, shortAddress } from '@/lib/format'

type View = 'connect' | 'connecting' | 'walletconnect' | 'network' | 'home' | 'pick-from' | 'pick-to' | 'review' | 'status' | 'account'

const SLIPPAGE_BPS = 50
const GAS_RESERVE = 500_000n
// Some wallets never reject the connect promise when the user closes or dismisses the request
// (WalletConnect in particular gives no signal). This backstop surfaces a failure instead of an
// endless spinner; a late approval still recovers to home via the isConnected effect.
const CONNECT_TIMEOUT_MS = 60_000

export default function Page() {
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const coven = useCoven()

  const [view, setView] = useState<View>('connect')
  const [connecting, setConnecting] = useState<Connector>()
  const [connectError, setConnectError] = useState<string>()
  const [inIframe, setInIframe] = useState(false)
  const [uri, setUri] = useState<string>()
  const [fromKey, setFromKey] = useState<string>()
  const [toKey, setToKey] = useState<string>()
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<Quote>()
  const [quoteNote, setQuoteNote] = useState<string>()
  const [quoting, setQuoting] = useState(false)
  const [totalUsdc, setTotalUsdc] = useState<bigint>()
  const amountRef = useRef<HTMLInputElement>(null)
  const connectAttempt = useRef(0)

  const { assets, count, newCount, refresh } = useAssets(address)
  const from = useMemo(() => assets.find((a) => a.key === fromKey), [assets, fromKey])
  const to = useMemo(() => assets.find((a) => a.key === toKey), [assets, toKey])
  const amountIn = useMemo(() => (from ? parseAmount(amount, from.token.decimals) : 0n), [amount, from])

  const { flow, resumable, resume, swap, bridgeOut, deposit, dismiss, discard } = useFlow({
    wallet: walletClient,
    address,
    switchChain: (id) => switchChainAsync({ chainId: id }),
    onSettled: refresh,
  })

  useEffect(() => {
    if (fromKey || assets.length === 0) return
    const usdcOnArc = assets.find((a) => !a.remote && a.token.address.toLowerCase() === USDC.toLowerCase())
    setFromKey(usdcOnArc?.key ?? assets[0]?.key)
  }, [assets, fromKey])

  useEffect(() => {
    if (!isConnected) return setView('connect')
    setView((current) => (current === 'connect' || current === 'connecting' || current === 'walletconnect' ? 'home' : current))
  }, [isConnected])

  // The Safe connector only has a provider inside the Safe{Wallet} app iframe; elsewhere it always
  // throws "Provider not found", so it is hidden unless we are actually running as a Safe App.
  useEffect(() => setInIframe(window.parent !== window), [])
  const visibleConnectors = useMemo(
    () => connectors.filter((connector) => connector.type !== 'safe' || inIframe),
    [connectors, inIframe],
  )

  useEffect(() => {
    if (flow) setView('status')
  }, [flow])

  useEffect(() => {
    let active = true
    const held = assets.filter((asset) => asset.balance && asset.balance > 0n).slice(0, 8)
    if (held.length === 0) {
      setTotalUsdc(undefined)
      return
    }
    void (async () => {
      let total = 0n
      for (const asset of held) {
        if (asset.token.address.toLowerCase() === USDC.toLowerCase()) {
          total += asset.balance ?? 0n
          continue
        }
        try {
          const priced = await coven.quote({
            tokenIn: asset.token.address,
            tokenOut: USDC,
            amountIn: asset.balance ?? 0n,
          })
          total += priced.amountOut
        } catch {
          // a holding with no route is left out of the total rather than guessed at
        }
      }
      if (active) setTotalUsdc(total)
    })()
    return () => {
      active = false
    }
  }, [assets, coven])

  useEffect(() => {
    setQuote(undefined)
    setQuoteNote(undefined)
    if (!from || !to || amountIn <= 0n) return
    if (from.remote) {
      setQuoteNote(
        to.remote || to.token.address.toLowerCase() === USDC.toLowerCase()
          ? `Brings USDC from ${from.chainName} to Arc.`
          : `Brings USDC from ${from.chainName}, then buys ${to.token.symbol} on Arc.`,
      )
      return
    }
    setQuoting(true)
    const timer = setTimeout(() => {
      const task = to.remote
        ? coven.bridge
            .quoteFromArc({ tokenIn: from.token.address, amountIn, destinationChainId: to.chainId })
            .then((result) =>
              setQuoteNote(
                `About ${formatUnitsCompact(result.minReceived, 6)} USDC lands on ${to.chainName}, after Circle's fee.`,
              ),
            )
        : coven.quote({ tokenIn: from.token.address, tokenOut: to.token.address, amountIn }).then(setQuote)
      task.catch((error: unknown) => setQuoteNote(errorText(error))).finally(() => setQuoting(false))
    }, 320)
    return () => clearTimeout(timer)
  }, [from, to, amountIn, coven])

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

  const start = useCallback(() => {
    if (!from || !to || amountIn <= 0n) return
    if (from.remote) return void deposit(from, to, amountIn, SLIPPAGE_BPS)
    if (to.remote) return void bridgeOut(from, to, amountIn, SLIPPAGE_BPS)
    return void swap(from, to, amountIn, SLIPPAGE_BPS)
  }, [amountIn, bridgeOut, deposit, from, swap, to])

  const outcome = quote && to ? `${formatUnitsCompact(quote.amountOut, to.token.decimals)} ${assetLabel(to)}` : undefined
  const ready = Boolean(from && to && amountIn > 0n && (quote || from.remote || to.remote))
  const feeLine = (q: Quote) =>
    `Fee ${formatUnitsCompact(q.platformFee + q.integratorFee, coven.tokens.get(q.feeToken)?.decimals ?? 6)} ${
      coven.tokens.get(q.feeToken)?.symbol ?? ''
    }, route ${q.hops.map((hop) => hop.protocol).join(' → ')}`

  if (view === 'connect') {
    return (
      <Card viewKey="connect">
        <ConnectView connectors={visibleConnectors} onConnect={(connector) => void connect(connector)} />
      </Card>
    )
  }

  if (view === 'connecting') {
    return (
      <Card viewKey={connectError ? 'connect-error' : 'connecting'}>
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
      </Card>
    )
  }

  if (view === 'walletconnect') {
    return (
      <Card viewKey="walletconnect">
        <WalletConnectView uri={uri} onBack={() => setView('connect')} />
      </Card>
    )
  }

  if (isConnected && chainId !== arc.id && view !== 'status') {
    return (
      <Card viewKey="network">
        <Label>Network</Label>
        <Title>Switch to Arc.</Title>
        <div className="mt-10 space-y-4">
          <Action onClick={() => void switchChainAsync({ chainId: arc.id }).catch(() => undefined)}>Switch</Action>
          <Action tone="ghost" onClick={() => disconnect()}>
            Disconnect
          </Action>
        </div>
      </Card>
    )
  }

  if (view === 'pick-from' || view === 'pick-to') {
    const pickingFrom = view === 'pick-from'
    return (
      <Card viewKey={view}>
        <AssetPicker
          assets={assets}
          title={pickingFrom ? 'You pay with' : 'You receive'}
          initialKey={pickingFrom ? fromKey : toKey}
          onConfirm={(asset: Asset) => {
            if (pickingFrom) setFromKey(asset.key)
            else setToKey(asset.key)
            setView('home')
          }}
          onCancel={() => setView('home')}
        />
      </Card>
    )
  }

  if (view === 'review' && from && to) {
    return (
      <Card viewKey="review">
        <Label>Review</Label>
        <Title>{outcome ?? `${amount} ${assetLabel(from)}`}</Title>
        <div className="mt-10 space-y-4 text-base tracking-tight text-black/45">
          <Row>
            <span>You pay</span>
            <span className="text-black">
              {amount} {assetLabel(from)}
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
            <span className="text-black">0.5%</span>
          </Row>
          {quoteNote && <Note>{quoteNote}</Note>}
          {(from.remote || to.remote) && (
            <Note>
              This takes a few minutes. Keep the tab open, or reopen Coven later and it carries on from where it stopped.
            </Note>
          )}
        </div>
        <div className="mt-10 space-y-4">
          <Action onClick={start}>Confirm</Action>
          <Action tone="ghost" onClick={() => setView('home')}>
            Back
          </Action>
        </div>
      </Card>
    )
  }

  if (view === 'status' && flow) {
    return (
      <Card viewKey={`status-${flow.title}`}>
        <Label>{flow.error ? 'Failed' : flow.done ? 'Done' : 'Working'}</Label>
        <Title>{flow.error ?? flow.title}</Title>
        <Ladder steps={flow.steps} />
        <div className="mt-8 space-y-4">
          {flow.detail && !flow.error && <Note>{flow.detail}</Note>}
          {!flow.done && !flow.error && (
            <Note>Keep this tab open. If you close it, reopen Coven and it carries on from here.</Note>
          )}
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
      </Card>
    )
  }

  if (view === 'account' && address) {
    return (
      <Card viewKey="account">
        <Label>Account</Label>
        <Title>{shortAddress(address)}</Title>
        <div className="mt-10 space-y-4 text-base tracking-tight text-black/45">
          <Row>
            <span>Total</span>
            <span className="text-black">
              {totalUsdc === undefined ? '…' : `${formatUnitsCompact(totalUsdc, 6)} USDC`}
            </span>
          </Row>
          {assets
            .filter((asset) => asset.balance && asset.balance > 0n)
            .slice(0, 6)
            .map((asset) => (
              <Row key={asset.key}>
                <span>{assetLabel(asset)}</span>
                <span className="text-black">{formatUnitsCompact(asset.balance ?? 0n, asset.token.decimals)}</span>
              </Row>
            ))}
        </div>
        <div className="mt-10 space-y-4">
          <Action onClick={() => setView('home')}>Back</Action>
          <Action tone="ghost" onClick={() => disconnect()}>
            Disconnect
          </Action>
        </div>
      </Card>
    )
  }

  return (
    <Card viewKey="home">
      <div className="flex flex-wrap items-baseline justify-between gap-6">
        <button type="button" className="tap" onClick={() => setView('pick-to')}>
          <Label>
            <CountUp to={newCount} duration={1.2} separator="," className="text-black font-bold" /> new assets
            {/* {newCount > 0 ? `, ${newCount} new` : ''} */}
          </Label>
        </button>
        <button type="button" className="tap" onClick={() => setView('account')}>
        <Label>
          balance
          <span className='text-black font-bold mx-1'>
          {totalUsdc === undefined ? ' —' : formatUnitsCompact(totalUsdc, 6)}
          </span>
          USDC
          </Label>
          </button>
      </div>

      <div className="mt-6">
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
            <Slot onClick={() => setView('pick-from')}>{from ? assetLabel(from) : '…'}</Slot>
          </span>
          <span className="block">
            <span className="text-black/35">get </span>
            <Slot onClick={() => setView('pick-to')} muted={!to}>
              {outcome ?? (to ? assetLabel(to) : 'something')}
            </Slot>
          </span>
        </Title>
      </div>

      <div className="mt-10 space-y-4">
        {from?.balance !== undefined && (
          <Action
            tone="ghost"
            onClick={() => {
              const keepsGas = !from.remote && from.token.address.toLowerCase() === USDC.toLowerCase()
              const reserve = keepsGas ? GAS_RESERVE : 0n
              const balance = from.balance ?? 0n
              const usable = balance > reserve ? balance - reserve : 0n
              setAmount(formatUnitsCompact(usable, from.token.decimals, from.token.decimals).replace(/,/g, ''))
              amountRef.current?.focus()
            }}
          >
            Max {formatUnitsCompact(from.balance, from.token.decimals)} {assetLabel(from)}
            {!from.remote && from.token.address.toLowerCase() === USDC.toLowerCase() ? ', keeping gas' : ''}
          </Action>
        )}
        <Note>
          {quoting
            ? 'Pricing…'
            : (quoteNote ?? (quote ? feeLine(quote) : 'Pick what you want, then type an amount.'))}
        </Note>
        <Action disabled={!ready} onClick={() => setView('review')}>
          Review
        </Action>
      </div>

      {resumable && (
        <div className="mt-10 space-y-4">
          <Note>{resumable.note} is still in progress.</Note>
          <Action onClick={() => void resume()}>Pick it up</Action>
          <Action tone="ghost" onClick={discard}>
            Forget it
          </Action>
        </div>
      )}

      <Nav>
        <Link href="/agent" className="tap text-black/45 underline decoration-black/25 underline-offset-[0.18em]">
          Let an agent trade
        </Link>
      </Nav>

    </Card>
  )
}
