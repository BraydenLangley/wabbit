import { useEffect, useRef, useState } from 'react'
import { useWallet } from './WalletContext'
import { ALLOWED_PARENT_ORIGINS } from './config'

type IncomingMessage =
  | { kind: 'call'; id: string; method: string; args: unknown }
  | { kind: 'request-login' }
  | { kind: 'logout' }

type OutgoingMessage =
  | { kind: 'ready'; version: 1 }
  | { kind: 'auth'; authenticated: boolean }
  | { kind: 'show' }
  | { kind: 'hide' }
  | { kind: 'result'; id: string; value: unknown }
  | { kind: 'error'; id: string; message: string }

type QueuedCall = { id: string; method: string; args: unknown; origin: string }

const originatorFromOrigin = (origin: string): string => {
  try {
    return new URL(origin).host || origin
  } catch {
    return origin
  }
}

const isOriginAllowed = (origin: string): boolean => {
  if (ALLOWED_PARENT_ORIGINS.length === 0) return true // demo/dev: permissive
  return ALLOWED_PARENT_ORIGINS.includes(origin)
}

export const PostMessageHost = () => {
  const { wallet, authenticated, pendingRequests, logout } = useWallet()
  const [loginRequested, setLoginRequested] = useState(false)

  const parentOriginRef = useRef<string | null>(null)
  const queuedCallsRef = useRef<QueuedCall[]>([])
  const lastAuthRef = useRef<boolean | null>(null)
  const lastShowStateRef = useRef<'show' | 'hide' | null>(null)

  /**
   * Safe post. Never uses '*' — if we don't yet know the parent origin
   * (i.e. before any message has arrived), messages are buffered until we do.
   * This prevents leaking auth/ready state to a hostile framing origin.
   */
  const outboundQueueRef = useRef<OutgoingMessage[]>([])
  const flushOutbound = (targetOrigin: string) => {
    const q = outboundQueueRef.current
    outboundQueueRef.current = []
    q.forEach(msg => window.parent.postMessage(msg, targetOrigin))
  }
  const post = (msg: OutgoingMessage, explicitOrigin?: string) => {
    const target = explicitOrigin ?? parentOriginRef.current
    if (!target) {
      // Buffer until we know the trusted parent.
      outboundQueueRef.current.push(msg)
      return
    }
    window.parent.postMessage(msg, target)
  }

  const dispatchCall = async (call: QueuedCall) => {
    if (!wallet) {
      post({ kind: 'error', id: call.id, message: 'Wallet not available' }, call.origin)
      return
    }
    try {
      const originator = originatorFromOrigin(call.origin)
      const fn = (wallet as unknown as Record<string, unknown>)[call.method]
      if (typeof fn !== 'function') throw new Error(`Unknown wallet method: ${call.method}`)
      const value = await (fn as (args: unknown, originator: string) => Promise<unknown>).call(
        wallet,
        call.args,
        originator
      )
      post({ kind: 'result', id: call.id, value }, call.origin)
    } catch (err) {
      post({ kind: 'error', id: call.id, message: (err as Error).message }, call.origin)
    }
  }

  // Announce ready on mount. This specific message is intentionally sent with
  // targetOrigin '*' because it's the bootstrapping handshake: we don't yet
  // know the parent's origin, and the parent SDK is *blocking* on this message
  // before it sends anything back. The message itself carries no sensitive data
  // — just "iframe is loaded." Every subsequent outgoing message uses the
  // locked parent origin (via post()) so there's no wildcard leak beyond this.
  useEffect(() => {
    window.parent.postMessage({ kind: 'ready', version: 1 }, '*')
    if (ALLOWED_PARENT_ORIGINS.length === 0 && window.parent !== window) {
      console.warn(
        '[wabbit] VITE_ALLOWED_PARENT_ORIGINS is not set. Any origin that frames this wallet ' +
          'will be trusted. Set an explicit allowlist before shipping to real users.'
      )
    }
  }, [])

  // Notify parent when auth state flips
  useEffect(() => {
    if (lastAuthRef.current !== authenticated) {
      lastAuthRef.current = authenticated
      post({ kind: 'auth', authenticated })
    }
    if (authenticated && loginRequested) setLoginRequested(false)
  }, [authenticated, loginRequested])

  // Tell parent whether iframe needs to be visible.
  useEffect(() => {
    const hasQueuedCalls = queuedCallsRef.current.length > 0
    const needsUI =
      pendingRequests.length > 0 ||
      (loginRequested && !authenticated) ||
      (hasQueuedCalls && !authenticated)
    const nextState: 'show' | 'hide' = needsUI ? 'show' : 'hide'
    if (lastShowStateRef.current !== nextState) {
      lastShowStateRef.current = nextState
      post({ kind: nextState })
    }
  }, [authenticated, pendingRequests.length, loginRequested])

  // Drain queued calls once the wallet is ready
  useEffect(() => {
    if (!authenticated || !wallet) return
    const toProcess = queuedCallsRef.current
    if (!toProcess.length) return
    queuedCallsRef.current = []
    toProcess.forEach(dispatchCall)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, wallet])

  // Listen for parent messages
  useEffect(() => {
    const onMessage = (e: MessageEvent<IncomingMessage>) => {
      // Reject messages from any non-allowlisted origin outright.
      if (!isOriginAllowed(e.origin)) {
        console.warn(`[wabbit] dropping message from non-allowlisted origin: ${e.origin}`)
        return
      }

      // Lock onto the first allowed origin that messages us.
      if (!parentOriginRef.current) {
        parentOriginRef.current = e.origin
        flushOutbound(e.origin)
      }
      // Only accept messages from the locked parent origin thereafter.
      if (e.origin !== parentOriginRef.current) return

      const msg = e.data
      if (!msg || typeof msg !== 'object') return

      switch (msg.kind) {
        case 'request-login':
          if (!authenticated) setLoginRequested(true)
          break
        case 'call':
          if (!wallet || !authenticated) {
            queuedCallsRef.current.push({
              id: msg.id,
              method: msg.method,
              args: msg.args,
              origin: e.origin,
            })
            if (!authenticated) setLoginRequested(true)
            return
          }
          dispatchCall({ id: msg.id, method: msg.method, args: msg.args, origin: e.origin })
          break
        case 'logout':
          logout()
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, authenticated, logout])

  return null
}
