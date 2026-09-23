'use client'

import { USDC, arc } from '@covennetwork/sdk'
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { type Address, isAddress, parseUnits } from 'viem'
import { useAccount, useConnect, useDisconnect, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'
import { Action, Card, Label, Note, Row, Title } from '@/components/Ui'
import { errorText } from '@/lib/flow'
import { shortAddress } from '@/lib/format'
import {
  SESSION_FACTORY,
  type SessionConfig,
  type TokenCapInput,
  approveToken,
  createSession,
  revokeSession,
  tokenDecimals,
} from '@/lib/session'

type SellRow = { address: string; perTrade: string; daily: string }

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs text-black/40 uppercase">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full border-b border-black/15 bg-transparent py-1 text-black outline-none placeholder:text-black/20 ${mono ? 'font-mono text-sm' : ''}`}
      />
    </label>
  )
}

export default function AgentPage() {
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const client = usePublicClient({ chainId: arc.id })

  const [sessionKey, setSessionKey] = useState('')
  const [usdcPerTrade, setUsdcPerTrade] = useState('100')
  const [usdcDaily, setUsdcDaily] = useState('500')
  const [sells, setSells] = useState<SellRow[]>([])
  const [days, setDays] = useState('30')
  const [delayHours, setDelayHours] = useState('1')
  const [tradesPerDay, setTradesPerDay] = useState('20')
  const [impactBps, setImpactBps] = useState('100')
  const [slippageBps, setSlippageBps] = useState('50')

  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string>()
  const [created, setCreated] = useState<{ session: Address; approvals: TokenCapInput[]; days: number }>()
  const [approved, setApproved] = useState<Record<string, boolean>>({})

  const mcpConfig = useMemo(() => {
    if (!created) return ''
    return JSON.stringify(
      {
        mcpServers: {
          coven: {
            command: 'npx',
            args: ['-y', '@covennetwork/mcp'],
            env: {
              ARC_RPC_URL: 'https://your-private-arc-endpoint',
              COVEN_SESSION_FACTORY: SESSION_FACTORY,
              COVEN_SESSION_ADDRESS: created.session,
              COVEN_SESSION_KEY: '0xyour-session-private-key',
            },
          },
        },
      },
      null,
      2,
    )
  }, [created])

  const create = useCallback(async () => {
    setNote(undefined)
    if (!walletClient || !client || !address) return setNote('Connect a wallet first.')
    if (!SESSION_FACTORY) return setNote('Session factory is not configured.')
    if (!isAddress(sessionKey)) return setNote('Session key must be an address. Generate one where the agent runs and paste it here.')
    if (sessionKey.toLowerCase() === address.toLowerCase()) return setNote('The session key must differ from your wallet.')
    const dh = Number(delayHours)
    if (!(dh >= 1)) return setNote('Change delay must be at least 1 hour.')
    const impact = Number(impactBps)
    if (!(impact >= 1 && impact <= 9999)) return setNote('Max impact must be 1 to 9999 bps.')
    const slip = Number(slippageBps)
    if (!(slip >= 0 && slip <= 9999)) return setNote('Max slippage must be 0 to 9999 bps.')
    setBusy(true)
    try {
      const tokens: TokenCapInput[] = [
        { token: USDC, perTradeCap: parseUnits(usdcPerTrade || '0', 6), dailyCap: parseUnits(usdcDaily || '0', 6) },
      ]
      for (const row of sells) {
        if (!isAddress(row.address)) throw new Error(`Not an address: ${row.address}`)
        const dec = await tokenDecimals(client, row.address as Address)
        tokens.push({
          token: row.address as Address,
          perTradeCap: parseUnits(row.perTrade || '0', dec),
          dailyCap: parseUnits(row.daily || '0', dec),
        })
      }
      const config: SessionConfig = {
        sessionKey: sessionKey as Address,
        changeDelay: BigInt(Math.round(dh * 3600)),
        expiry: Math.floor(Date.now() / 1000) + Number(days) * 86400,
        tradeCountCap: Number(tradesPerDay),
        maxImpactBps: impact,
        maxSlippageBps: slip,
        tokens,
      }
      const { session } = await createSession({ wallet: walletClient, client, factory: SESSION_FACTORY, owner: address, config })
      setCreated({ session, approvals: tokens, days: Number(days) })
    } catch (e) {
      setNote(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [address, client, days, delayHours, impactBps, sells, sessionKey, slippageBps, tradesPerDay, usdcDaily, usdcPerTrade, walletClient])

  const approve = useCallback(
    async (cap: TokenCapInput, days_: number) => {
      if (!walletClient || !created) return
      setNote(undefined)
      try {
        const amount = cap.dailyCap * BigInt(Math.max(1, days_))
        await approveToken(walletClient, cap.token, created.session, amount)
        setApproved((prev) => ({ ...prev, [cap.token.toLowerCase()]: true }))
      } catch (e) {
        setNote(errorText(e))
      }
    },
    [created, walletClient],
  )

  const revoke = useCallback(async () => {
    if (!walletClient || !created) return
    try {
      await revokeSession(walletClient, created.session)
      setNote('Session revoked. It is dead; create a new one to resume.')
    } catch (e) {
      setNote(errorText(e))
    }
  }, [created, walletClient])

  if (!SESSION_FACTORY) {
    return (
      <Card viewKey="agent-nofactory">
        <Label>Agent</Label>
        <Title>Not configured.</Title>
        <div className="mt-8 space-y-4">
          <Note>
            The CovenSessionFactory address is not set. The operator deploys it once with deploy-factory.sh, then sets
            NEXT_PUBLIC_COVEN_SESSION_FACTORY. Until then, sessions cannot be created here.
          </Note>
          <Link href="/" className="tap underline decoration-black/25 underline-offset-4">
            Back to swap
          </Link>
        </div>
      </Card>
    )
  }

  if (!isConnected) {
    return (
      <Card viewKey="agent-connect">
        <Label>Agent</Label>
        <Title>Connect to set up a session.</Title>
        <div className="mt-10 space-y-4">
          {connectors.slice(0, 4).map((c) => (
            <Action key={c.uid} onClick={() => void connectAsync({ connector: c }).catch((e) => setNote(errorText(e)))}>
              Connect {c.name}
            </Action>
          ))}
          {note && <Note>{note}</Note>}
        </div>
      </Card>
    )
  }

  if (chainId !== arc.id) {
    return (
      <Card viewKey="agent-network">
        <Label>Agent</Label>
        <Title>Switch to Arc.</Title>
        <div className="mt-10 space-y-4">
          <Action onClick={() => void switchChainAsync({ chainId: arc.id }).catch(() => undefined)}>Switch</Action>
        </div>
      </Card>
    )
  }

  if (created) {
    return (
      <Card viewKey="agent-created">
        <Label>Agent session</Label>
        <Title>Session live.</Title>
        <div className="mt-8 space-y-5 text-base tracking-tight text-black/45">
          <Row>
            <span>Session</span>
            <a
              className="tap font-mono text-sm text-black underline decoration-black/25 underline-offset-4"
              href={`https://explorer.arc.io/address/${created.session}`}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddress(created.session)}
            </a>
          </Row>
          <Note>Approve the session to pull each token from your wallet. It can only pull to swap, within your caps, and proceeds return to you.</Note>
          <div className="space-y-3">
            {created.approvals.map((cap) => (
              <Action
                key={cap.token}
                tone="ghost"
                onClick={() => void approve(cap, created.days)}
                disabled={approved[cap.token.toLowerCase()]}
              >
                {approved[cap.token.toLowerCase()] ? 'Approved' : 'Approve'} {cap.token.toLowerCase() === USDC.toLowerCase() ? 'USDC' : shortAddress(cap.token)}
              </Action>
            ))}
          </div>
          <Note>Then point your MCP client at the session. Keep the session private key with the server only.</Note>
          <pre className="overflow-x-auto rounded border border-black/10 bg-white/5 p-4 font-mono text-xs text-black/80">{mcpConfig}</pre>
          <Action tone="ghost" onClick={() => void navigator.clipboard.writeText(mcpConfig)}>
            Copy config
          </Action>
          {note && <Note>{note}</Note>}
        </div>
        <div className="mt-10 space-y-4">
          <Action tone="ghost" onClick={() => void revoke()}>
            Revoke session
          </Action>
          <Link href="/" className="tap block text-black/45 underline decoration-black/25 underline-offset-4">
            Back to swap
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card viewKey="agent-form">
      <Label>Agent session</Label>
      <Title>Let an agent trade, within limits.</Title>
      <div className="mt-8 max-w-xl space-y-6">
        <Note>
          A session lets an agent trade with your funds up to caps enforced on chain. Your money stays in your wallet;
          the agent holds a hot key that can only swap within these limits. You can revoke any time.
        </Note>
        <Field label="Session key address" value={sessionKey} onChange={setSessionKey} placeholder="0x… (paste the agent's key address)" mono />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Buy cap per trade (USDC)" value={usdcPerTrade} onChange={setUsdcPerTrade} />
          <Field label="Buy cap per day (USDC)" value={usdcDaily} onChange={setUsdcDaily} />
        </div>

        <div className="space-y-3">
          <Label>Sellable tokens (caps in token units)</Label>
          {sells.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-3">
              <Field label="Token" value={row.address} onChange={(v) => setSells((s) => s.map((r, j) => (j === i ? { ...r, address: v } : r)))} placeholder="0x…" mono />
              <Field label="Per trade" value={row.perTrade} onChange={(v) => setSells((s) => s.map((r, j) => (j === i ? { ...r, perTrade: v } : r)))} />
              <Field label="Per day" value={row.daily} onChange={(v) => setSells((s) => s.map((r, j) => (j === i ? { ...r, daily: v } : r)))} />
            </div>
          ))}
          <Action tone="ghost" onClick={() => setSells((s) => [...s, { address: '', perTrade: '', daily: '' }])}>
            Add a token
          </Action>
          {sells.length > 0 && (
            <Action tone="ghost" onClick={() => setSells((s) => s.slice(0, -1))}>
              Remove last
            </Action>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Expiry (days)" value={days} onChange={setDays} />
          <Field label="Trades per day" value={tradesPerDay} onChange={setTradesPerDay} />
          <Field label="Change delay (hours, min 1)" value={delayHours} onChange={setDelayHours} />
          <Field label="Max impact (bps)" value={impactBps} onChange={setImpactBps} />
          <Field label="Max slippage (bps)" value={slippageBps} onChange={setSlippageBps} />
        </div>

        <div className="space-y-4 pt-2">
          <Action disabled={busy} onClick={() => void create()}>
            {busy ? 'Creating…' : 'Create session'}
          </Action>
          {note && <Note>{note}</Note>}
          <Link href="/" className="tap block text-black/45 underline decoration-black/25 underline-offset-4">
            Back to swap
          </Link>
        </div>
      </div>
    </Card>
  )
}
