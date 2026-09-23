import type { Address } from 'viem'
import { COVEN_SESSION_FACTORY } from '@covennetwork/core'
// The session/factory bindings live in @covennetwork/core, shared with the MCP server.
// This module only adds the app's deployment-specific factory address from the environment.
export {
  createSession,
  predictSession,
  approveToken,
  allowanceOf,
  revokeSession,
  sessionStatus,
  tokenDecimals,
  isFactorySession,
  type SessionConfig,
  type TokenCapInput,
} from '@covennetwork/core'

// The CovenSessionFactory. Defaults to the canonical Arc deployment; override in the
// environment to point at a different one. Creating a session is one factory.create
// transaction the owner signs with their own wallet, and the session is owned by whoever
// sends it, so the connected wallet must be the intended owner.
export const SESSION_FACTORY = (process.env.NEXT_PUBLIC_COVEN_SESSION_FACTORY as Address | undefined) ?? COVEN_SESSION_FACTORY
