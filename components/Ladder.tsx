'use client'

import type { Step } from '@/lib/flow'

export function Ladder({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-10 space-y-4">
      {steps.map((step) => (
        <li
          key={step.id}
          className={`flex items-center gap-4 text-sm tracking-[0.28em] uppercase transition-opacity duration-300 ${
            step.state === 'active' ? 'text-white' : step.state === 'done' ? 'text-white/55' : 'text-white/20'
          }`}
        >
          <span aria-hidden className="w-5 text-center">
            {step.state === 'done' ? '✓' : step.state === 'failed' ? '✕' : ''}
          </span>
          <span>{step.label}</span>
          {step.state === 'active' && <span className="h-px flex-1 animate-pulse bg-white/25" />}
        </li>
      ))}
    </ol>
  )
}
