'use client'

import type { Coven, Integrator } from '@covennetwork/sdk'
import { createContext, useContext, useMemo } from 'react'
import { coven as defaultCoven, createCovenClient } from './coven'

// The active Coven client, shared through React context. The main app provides the
// environment-configured client; the embeddable widget provides one built from the
// integrator address it was loaded with, so hooks below never need to know which.
const CovenContext = createContext<Coven>(defaultCoven)

export function CovenProvider({ integrator, children }: { integrator?: Integrator; children: React.ReactNode }) {
  const client = useMemo(
    () => (integrator?.address ? createCovenClient(integrator) : defaultCoven),
    [integrator?.address, integrator?.feeBps],
  )
  return <CovenContext.Provider value={client}>{children}</CovenContext.Provider>
}

export const useCoven = () => useContext(CovenContext)
