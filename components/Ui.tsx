'use client'

export function Card({ children, viewKey }: { children: React.ReactNode; viewKey: string }) {
  return (
    <main className="flex w-full flex-1 items-center justify-center px-6 py-14">
      <section key={viewKey} className="view-enter w-full max-w-5xl">
        {children}
      </section>
    </main>
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-white/40 uppercase">{children}</p>
}

export function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-[clamp(1.9rem,7vw,5.5rem)] leading-[0.95] font-medium tracking-[-0.045em] text-balance">
      {children}
    </h1>
  )
}

export function Slot({
  children,
  onClick,
  muted,
}: {
  children: React.ReactNode
  onClick?: () => void
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap underline decoration-white/25 decoration-2 underline-offset-[0.18em] ${
        muted ? 'text-white/40' : 'text-white'
      }`}
    >
      {children}
    </button>
  )
}

export function Action({
  children,
  onClick,
  disabled,
  tone = 'solid',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'solid' | 'ghost'
}) {
  const base = 'tap block text-left leading-none font-medium tracking-[-0.03em]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        tone === 'solid'
          ? `${base} text-[clamp(1.6rem,4vw,2.5rem)] text-white disabled:text-white/20`
          : `${base} text-[clamp(1rem,2vw,1.25rem)] text-white/45 disabled:text-white/15`
      }
    >
      {children}
    </button>
  )
}

export function Nav({ children }: { children: React.ReactNode }) {
  return (
    <nav className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-white/10 pt-6">{children}</nav>
  )
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-base leading-snug tracking-tight text-white/45">{children}</p>
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-6">{children}</div>
}
