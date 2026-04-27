import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useWabbit } from './useWabbit'

export interface WabbitLoginButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'> {
  /** Override the default label. */
  children?: ReactNode
  /** Override the default label when loading. */
  loadingLabel?: ReactNode
  /** Override the default label when already authenticated (defaults to "Log out"). */
  authenticatedLabel?: ReactNode
  /** Called after a successful login. */
  onAuthenticated?: () => void
}

/**
 * Drop-in "Sign in with wabbit" button.
 *
 * Internally calls `useWabbit().login()` on click. When the user is already
 * authenticated, switches to a logout action.
 */
export const WabbitLoginButton = ({
  children,
  loadingLabel,
  authenticatedLabel,
  onAuthenticated,
  disabled,
  ...rest
}: WabbitLoginButtonProps) => {
  const { ready, authenticated, login, logout, error } = useWabbit()
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    if (authenticated) {
      logout()
      return
    }
    setBusy(true)
    try {
      await login()
      onAuthenticated?.()
    } catch (err) {
      console.error('[wabbit] login failed:', err)
    } finally {
      setBusy(false)
    }
  }

  const label = authenticated
    ? authenticatedLabel ?? 'Log out'
    : busy
    ? loadingLabel ?? 'Signing in…'
    : children ?? 'Sign in with wabbit'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || !ready || busy || !!error}
      {...rest}
    >
      {label}
    </button>
  )
}
