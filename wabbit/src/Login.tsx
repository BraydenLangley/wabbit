import { useState, type FormEvent } from 'react'
import { useWallet } from './WalletContext'

type Step = 'phone' | 'code' | 'password'
type Mode = 'login' | 'recover-phone' | 'recover-password'

export type LoginProps = {
  onSwitchMode?: (mode: Mode) => void
}

export const Login = ({ onSwitchMode }: LoginProps) => {
  const { walletManager, providePassword, authFlow } = useWallet()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  const submitPhone = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!walletManager) return
    setError(null)
    setLoading(true)
    try {
      await walletManager.startAuth({ phoneNumber: phone })
      setStep('code')
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const submitCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!walletManager) return
    setError(null)
    setLoading(true)
    try {
      await walletManager.completeAuth({ phoneNumber: phone, otp: code })
      setStep('password')
    } catch (err) {
      setError((err as Error).message || 'That code didn\'t work. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resendCode = async () => {
    if (!walletManager || resendCooldown > 0) return
    try {
      setLoading(true)
      await walletManager.startAuth({ phoneNumber: phone })
      setResendCooldown(30)
      const interval = window.setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            window.clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError((err as Error).message || 'Couldn\'t resend the code')
    } finally {
      setLoading(false)
    }
  }

  const submitPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (authFlow === 'new-user' && password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    if (authFlow === 'new-user' && password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await providePassword(password)
    } catch (err) {
      setError((err as Error).message || 'That password didn\'t work.')
    } finally {
      setLoading(false)
    }
  }

  const heading = (() => {
    if (step === 'phone') return 'Sign in'
    if (step === 'code') return 'Check your phone'
    if (authFlow === 'new-user') return 'Create your account'
    return 'Welcome back'
  })()

  const subhead = (() => {
    if (step === 'phone') return "Enter your phone number to sign in or create an account."
    if (step === 'code') return `We texted a code to ${phone || 'your phone'}.`
    if (authFlow === 'new-user') return 'Choose a password. You\'ll use this to sign in next time.'
    return 'Enter your password to continue.'
  })()

  const stepIndex = step === 'phone' ? 0 : step === 'code' ? 1 : 2

  return (
    <div className="login-card">
      <div className="brand">
        <div className="brand-mark">w</div>
        <span className="brand-word">wabbit</span>
      </div>

      <div className="steps" aria-hidden="true">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`step ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}`}
          />
        ))}
      </div>

      <h1>{heading}</h1>
      <p className="subhead">{subhead}</p>

      {step === 'phone' && (
        <form onSubmit={submitPhone}>
          <label>Phone number</label>
          <input
            type="tel"
            placeholder="+1 (555) 123-4567"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            autoFocus
            required
            autoComplete="tel"
          />
          <button type="submit" disabled={loading || !walletManager}>
            {loading ? 'Sending…' : 'Continue'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={submitCode}>
          <label>6-digit code</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={e => setCode(e.target.value)}
            autoFocus
            required
            maxLength={6}
            autoComplete="one-time-code"
          />
          <button type="submit" disabled={loading || code.length < 6}>
            {loading ? 'Verifying…' : 'Continue'}
          </button>
          <div className="row-links">
            <button type="button" className="link" onClick={() => setStep('phone')}>
              Use a different number
            </button>
            <button
              type="button"
              className="link"
              onClick={resendCode}
              disabled={resendCooldown > 0 || loading}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={submitPassword}>
          <label>{authFlow === 'new-user' ? 'Choose a password' : 'Password'}</label>
          <div className="password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              required
              minLength={authFlow === 'new-user' ? 8 : undefined}
              autoComplete={authFlow === 'new-user' ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className="link password-toggle"
              onClick={() => setShowPassword(s => !s)}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {authFlow === 'new-user' && (
            <>
              <label>Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </>
          )}

          <button type="submit" disabled={loading}>
            {loading
              ? 'Please wait…'
              : authFlow === 'new-user'
              ? 'Create account'
              : 'Sign in'}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      {onSwitchMode && step !== 'password' && (
        <div className="row-links recovery-links">
          <button type="button" className="link" onClick={() => onSwitchMode('recover-phone')}>
            Lost your phone?
          </button>
          <button type="button" className="link" onClick={() => onSwitchMode('recover-password')}>
            Forgot your password?
          </button>
        </div>
      )}
    </div>
  )
}
