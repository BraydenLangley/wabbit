import { createContext } from 'react'
import type { WalletInterface } from '@bsv/sdk'

export interface WabbitContextValue {
  /** True once the iframe has handshaken. */
  ready: boolean
  /** True after the user completes the wallet's auth flow. */
  authenticated: boolean
  /**
   * A BRC-100 WalletInterface proxied to the hosted wallet.
   * Safe to call before authentication — calls queue and resolve once the
   * user signs in (the iframe auto-opens the login UI on demand).
   */
  wallet: WalletInterface | null
  /** Surfaces the hosted-wallet login UI. Resolves when the user completes auth. */
  login: () => Promise<void>
  /** Signs out and clears the hosted session. */
  logout: () => void
  /** Any boot error from createWabbit(). */
  error: Error | null
}

export const WabbitContext = createContext<WabbitContextValue | null>(null)
