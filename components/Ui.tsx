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
  return <p className="text-xs text-black/40 uppercase">{children}</p>
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
      className={`tap underline decoration-black/25 decoration-2 underline-offset-[0.18em] ${
        muted ? 'text-black/40' : 'text-black'
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
          ? `${base} text-[clamp(1.6rem,4vw,2.5rem)] text-black disabled:text-black/20`
          : `${base} text-[clamp(1rem,2vw,1.25rem)] text-black/45 disabled:text-black/15`
      }
    >
      {children}
    </button>
  )
}

export function Nav({ children }: { children: React.ReactNode }) {
  return (
    <nav className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4 pt-6">{children}</nav>
  )
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-base leading-snug tracking-tight text-black/45">{children}</p>
}

export function Dots() {
  return (
    <span className="loading-dots" role="status" aria-label="Loading">
      <span />
      <span />
      <span />
    </span>
  )
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-6">{children}</div>
}
