export const WAB_URL = import.meta.env.VITE_WAB_URL ?? 'https://wab.babbage.systems'
export const STORAGE_URL = import.meta.env.VITE_STORAGE_URL ?? 'https://storage.babbage.systems'
export const CHAIN: 'main' | 'test' = (import.meta.env.VITE_CHAIN as 'main' | 'test') ?? 'main'
export const ADMIN_ORIGINATOR = import.meta.env.VITE_ADMIN_ORIGINATOR ?? 'admin.wabbit.local'
export const TODO_ORIGINATOR = 'todo.wabbit.local'

// Auto-lock wallet after this many ms of inactivity (user re-auths via password only).
export const IDLE_LOCK_MS = 10 * 60 * 1000

/**
 * Comma-separated list of origins allowed to embed the wallet iframe and
 * send postMessage requests. Example:
 *   VITE_ALLOWED_PARENT_ORIGINS="https://app.example.com,https://staging.example.com"
 *
 * Empty (or unset) means "allow any origin" — acceptable for local dev and
 * open demos, but NOT for production. The PostMessageHost logs a prominent
 * warning when this is empty.
 */
export const ALLOWED_PARENT_ORIGINS: readonly string[] = (
  import.meta.env.VITE_ALLOWED_PARENT_ORIGINS ?? ''
)
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean)
