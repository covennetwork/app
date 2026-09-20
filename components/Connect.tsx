'use client'

import { useEffect, useState } from 'react'
import type { Connector } from 'wagmi'
import { Qr } from './Qr'
import { Action, Label, Note, Title } from './Ui'
import { Wheel } from './Wheel'

export const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches

export function ConnectView({
  connectors,
  onConnect,
}: {
  connectors: readonly Connector[]
  onConnect: (connector: Connector) => void
}) {
  const [index, setIndex] = useState(0)
  const selected = connectors[index]
  return (
    <>
      <Label>Coven</Label>
      <Title>Swap on Arc.</Title>
      <div className="mt-8">
        <Wheel items={connectors.map((c) => c.name)} onSelect={setIndex} />
      </div>
      <div className="mt-10 space-y-4">
        <Action onClick={() => selected && onConnect(selected)} disabled={!selected}>
          Connect {selected?.name ?? ''}
        </Action>
        <Note>Spin the wheel, then connect.</Note>
      </div>
    </>
  )
}

export function WalletConnectView({ uri, onBack }: { uri?: string; onBack: () => void }) {
  const [phone, setPhone] = useState(false)
  const [opened, setOpened] = useState(false)

  useEffect(() => setPhone(isTouchDevice()), [])

  useEffect(() => {
    if (!phone || !uri || opened) return
    setOpened(true)
    window.location.href = uri
  }, [opened, phone, uri])

  if (phone) {
    return (
      <>
        <Label>WalletConnect</Label>
        <Title>Opening your wallet.</Title>
        <div className="mt-10 space-y-4">
          <Action onClick={() => uri && (window.location.href = uri)} disabled={!uri}>
            Open wallet
          </Action>
          <Note>If nothing happened, tap Open wallet. Come back here once you have approved it.</Note>
          <Action tone="ghost" onClick={onBack}>
            Back
          </Action>
        </div>
      </>
    )
  }

  return (
    <>
      <Label>WalletConnect</Label>
      <Title>Scan.</Title>
      <div className="mt-10 flex justify-center">{uri ? <Qr value={uri} /> : <Note>Preparing…</Note>}</div>
      <div className="mt-10">
        <Action tone="ghost" onClick={onBack}>
          Back
        </Action>
      </div>
    </>
  )
}
