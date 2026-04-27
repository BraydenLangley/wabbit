import type { WalletInterface } from '@bsv/sdk'

export interface WabbitConfig {
  /** Origin of the hosted wabbit wallet, e.g. https://wallet.wabbit.io */
  origin: string
  /** DOM element to mount the iframe into. Defaults to document.body. */
  mount?: HTMLElement
  /** Optional handshake timeout in ms (default 10_000). */
  handshakeTimeoutMs?: number
}

export interface WabbitHandle {
  /** A WalletInterface whose calls are proxied to the iframe. */
  wallet: WalletInterface
  /** Current authentication state. Updated by the iframe. */
  readonly authenticated: boolean
  /** Subscribe to auth state changes. Returns an unsubscribe fn. */
  onAuthStateChange(handler: (authenticated: boolean) => void): () => void
  /** Ask the hosted wallet to surface its login UI. Resolves when login completes. */
  login(): Promise<void>
  /** Ask the hosted wallet to log out. */
  logout(): void
  /** Remove the iframe and detach listeners. */
  destroy(): void
}

type IncomingFromIframe =
  | { kind: 'ready'; version: number }
  | { kind: 'auth'; authenticated: boolean }
  | { kind: 'show' }
  | { kind: 'hide' }
  | { kind: 'result'; id: string; value: unknown }
  | { kind: 'error'; id: string; message: string }

const randomId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function createWabbit(config: WabbitConfig): Promise<WabbitHandle> {
  const { origin, mount = document.body, handshakeTimeoutMs = 10_000 } = config

  // Guard against http://* origins when the parent page is https://*.
  // Browsers would block mixed content anyway, but fail loudly here.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && origin.startsWith('http://')) {
    throw new Error(
      `[wabbit-sdk] refusing to load an http:// wallet origin (${origin}) from an https:// page. ` +
        'Use an https:// wallet origin in production.'
    )
  }

  const iframe = document.createElement('iframe')
  iframe.src = `${origin}/?embed=1`
  iframe.title = 'wabbit wallet'
  // Passkey access for future WebAuthn gating, plus clipboard for copy-paste of recovery keys.
  iframe.allow = 'publickey-credentials-get *; publickey-credentials-create *; clipboard-read; clipboard-write'
  // allow-same-origin is required so the iframe can use its own localStorage (the wallet snapshot).
  // allow-popups removed — never needed for wallet ops.
  iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin')
  iframe.style.cssText = [
    'position: fixed',
    'inset: 0',
    'width: 100%',
    'height: 100%',
    'border: 0',
    'z-index: 2147483647',
    'display: none',
    'background: transparent',
  ].join(';')

  mount.appendChild(iframe)

  let authenticated = false
  const authSubs = new Set<(a: boolean) => void>()
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  let destroyed = false

  const onMessage = (e: MessageEvent<IncomingFromIframe>) => {
    if (e.origin !== origin) return
    const msg = e.data
    if (!msg || typeof msg !== 'object') return

    switch (msg.kind) {
      case 'auth':
        authenticated = msg.authenticated
        authSubs.forEach(fn => {
          try {
            fn(authenticated)
          } catch (err) {
            console.error('[wabbit-sdk] auth subscriber threw:', err)
          }
        })
        break
      case 'show':
        iframe.style.display = 'block'
        break
      case 'hide':
        iframe.style.display = 'none'
        break
      case 'result': {
        const p = pending.get(msg.id)
        if (p) {
          p.resolve(msg.value)
          pending.delete(msg.id)
        }
        break
      }
      case 'error': {
        const p = pending.get(msg.id)
        if (p) {
          p.reject(new Error(msg.message))
          pending.delete(msg.id)
        }
        break
      }
    }
  }

  window.addEventListener('message', onMessage)

  // Wait for the iframe's initial `ready`
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onReady)
      reject(new Error(`wabbit iframe handshake timed out after ${handshakeTimeoutMs}ms`))
    }, handshakeTimeoutMs)
    const onReady = (e: MessageEvent<IncomingFromIframe>) => {
      if (e.origin !== origin) return
      if (e.data?.kind === 'ready') {
        window.clearTimeout(timeout)
        window.removeEventListener('message', onReady)
        resolve()
      }
    }
    window.addEventListener('message', onReady)
  })

  const call = (method: string, args: unknown): Promise<unknown> => {
    if (destroyed) return Promise.reject(new Error('wabbit handle has been destroyed'))
    return new Promise((resolve, reject) => {
      const id = randomId()
      pending.set(id, { resolve, reject })
      iframe.contentWindow?.postMessage({ kind: 'call', id, method, args }, origin)
    })
  }

  const wallet = new Proxy({} as WalletInterface, {
    get(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined
      // Make sure the proxy doesn't look like a thenable.
      if (prop === 'then') return undefined
      return (args: unknown) => call(prop, args)
    },
  }) as WalletInterface

  return {
    wallet,
    get authenticated() {
      return authenticated
    },
    onAuthStateChange(handler: (a: boolean) => void) {
      authSubs.add(handler)
      // Emit current state on subscribe
      try {
        handler(authenticated)
      } catch {
        // ignore
      }
      return () => authSubs.delete(handler)
    },
    login() {
      if (authenticated) return Promise.resolve()
      return new Promise<void>(resolve => {
        const unsub = (() => {
          const handler = (a: boolean) => {
            if (a) {
              authSubs.delete(handler)
              resolve()
            }
          }
          authSubs.add(handler)
          return () => authSubs.delete(handler)
        })()
        iframe.contentWindow?.postMessage({ kind: 'request-login' }, origin)
        // If the handle is destroyed while waiting, resolve to unblock callers.
        const onUnmount = () => {
          unsub()
          resolve()
        }
        window.addEventListener('beforeunload', onUnmount, { once: true })
      })
    },
    logout() {
      iframe.contentWindow?.postMessage({ kind: 'logout' }, origin)
    },
    destroy() {
      destroyed = true
      window.removeEventListener('message', onMessage)
      pending.forEach(p => p.reject(new Error('wabbit handle destroyed')))
      pending.clear()
      iframe.remove()
    },
  }
}
