import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createWabbit, type WabbitHandle } from 'wabbit-sdk'
import { WabbitContext, type WabbitContextValue } from './context'

export interface WabbitProviderProps {
  /** Origin of the hosted wabbit wallet, e.g. https://wallet.wabbit.io */
  origin: string
  /** Optional DOM node to mount the iframe into. Defaults to document.body. */
  mount?: HTMLElement
  /** Optional handshake timeout. */
  handshakeTimeoutMs?: number
  children: ReactNode
}

/**
 * Boots a wabbit hosted-wallet iframe once and exposes it to descendants via
 * `useWabbit()`. Safe to mount at the root of any React tree.
 */
export const WabbitProvider = ({
  origin,
  mount,
  handshakeTimeoutMs,
  children,
}: WabbitProviderProps) => {
  const [handle, setHandle] = useState<WabbitHandle | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const handleRef = useRef<WabbitHandle | null>(null)

  useEffect(() => {
    let cancelled = false
    createWabbit({ origin, mount, handshakeTimeoutMs })
      .then(h => {
        if (cancelled) {
          h.destroy()
          return
        }
        handleRef.current = h
        setHandle(h)
        h.onAuthStateChange(a => setAuthenticated(a))
      })
      .catch(err => {
        if (!cancelled) setError(err as Error)
      })
    return () => {
      cancelled = true
      handleRef.current?.destroy()
      handleRef.current = null
    }
    // origin / mount / handshakeTimeoutMs are effectively static — re-mounting the
    // provider with a different origin would require tearing down the iframe anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<WabbitContextValue>(
    () => ({
      ready: handle !== null,
      authenticated,
      wallet: handle?.wallet ?? null,
      login: async () => {
        if (!handle) throw new Error('wabbit is not ready yet')
        await handle.login()
      },
      logout: () => handle?.logout(),
      error,
    }),
    [handle, authenticated, error]
  )

  return <WabbitContext.Provider value={value}>{children}</WabbitContext.Provider>
}
