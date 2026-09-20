'use client'

import { useState } from 'react'
import { assetLabel, type Asset } from '@/lib/assets'
import { formatUnitsCompact, shortAddress } from '@/lib/format'
import { Action, Label, Note, Row } from './Ui'
import { Wheel } from './Wheel'

export function AssetPicker({
  assets,
  title,
  initialKey,
  onConfirm,
  onCancel,
}: {
  assets: Asset[]
  title: string
  initialKey?: string
  onConfirm: (asset: Asset) => void
  onCancel: () => void
}) {
  const start = Math.max(
    0,
    assets.findIndex((a) => a.key === initialKey),
  )
  const [index, setIndex] = useState(start)
  const selected = assets[index] ?? assets[0]

  return (
    <>
      <Label>{title}</Label>
      <div className="mt-8 grid gap-12 md:grid-cols-[1.15fr_1fr] md:items-center">
        <Wheel
          items={assets.map((asset) => assetLabel(asset) + (asset.isNew ? '  new' : ''))}
          defaultSelected={start}
          onSelect={setIndex}
        />
        {selected && (
          <dl className="space-y-4 text-sm tracking-tight text-white/45">
            <Row>
              <dt>Name</dt>
              <dd className="text-white">{selected.token.name}</dd>
            </Row>
            <Row>
              <dt>Network</dt>
              <dd className="text-white">{selected.chainName}</dd>
            </Row>
            <Row>
              <dt>Balance</dt>
              <dd className="text-white">
                {selected.balance === undefined
                  ? '—'
                  : `${formatUnitsCompact(selected.balance, selected.token.decimals)} ${selected.token.symbol}`}
              </dd>
            </Row>
            <Row>
              <dt>Decimals</dt>
              <dd className="text-white">{selected.token.decimals}</dd>
            </Row>
            <Row>
              <dt>Contract</dt>
              <dd className="text-white">{shortAddress(selected.token.address)}</dd>
            </Row>
            <p className="pt-1 text-[0.78rem] leading-relaxed break-all text-white/30">
              {selected.token.address}
            </p>
            {selected.token.flags.impersonator && (
              <Note>This token borrows a name from a well known one. Check the address.</Note>
            )}
          </dl>
        )}
      </div>
      <div className="mt-12 space-y-4">
        <Action onClick={() => selected && onConfirm(selected)} disabled={!selected}>
          Use {selected ? assetLabel(selected) : '…'}
        </Action>
        <Action tone="ghost" onClick={onCancel}>
          Cancel
        </Action>
      </div>
    </>
  )
}
