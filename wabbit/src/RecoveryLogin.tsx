import { useState, type FormEvent } from 'react'
import { useWallet } from './WalletContext'
import { mnemonicToEntropy } from './keyMaterial'

type Mode = 'recover-phone' | 'recover-password'

export type RecoveryLoginProps = {
  mode: Mode
  onCancel: () => void
}

export const RecoveryLogin = ({ mode, onCancel }: RecoveryLoginProps) => {
  const { walletManager, providePassword, changePassword } = useWallet()

  const [mnemonic, setMnemonic] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'collect' | 'phone' | 'code' | 'newpw'>(
    mode === 'recover-phone' ? 'collect' : 'phone'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitLostPhone = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!walletManager) return
    setError(null)
    setLoading(true)
    try {
      const bytes = mnemonicToEntropy(mnemonic)
      await walletManager.provideRecoveryKey(bytes)
      await providePassword(password)
    } catch (err) {
      setError((err as Error).message || 'Recovery failed. Double-check your phrase and password.')
    } finally {
      setLoading(false)
    }
  }

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
      setStep('newpw')
    } catch (err) {
      setError((err as Error).message || 'That code didn\'t work. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const submitMnemonicAndNewPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!walletManager) return
    setError(null)
    if (password !== confirmPw) {
      setError("Passwords don't match")
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const bytes = mnemonicToEntropy(mnemonic)
      await walletManager.provideRecoveryKey(bytes)
      await changePassword(password)
    } catch (err) {
      setError((err as Error).message || 'Recovery failed. Double-check your phrase.')
    } finally {
      setLoading(false)
    }
  }

  const heading =
    mode === 'recover-phone' ? 'Recover your account' : 'Reset your password'

  const subhead = (() => {
    if (mode === 'recover-phone')
      return 'Enter your recovery phrase and password to sign back in.'
    if (step === 'phone') return "We'll text you a code to verify it's you."
    if (step === 'code') return `We texted a code to ${phone || 'your phone'}.`
    return 'Enter your recovery phrase and choose a new password.'
  })()

  const stepIndex =
    mode === 'recover-phone'
      ? 0
      : step === 'phone'
      ? 0
      : step === 'code'
      ? 1
      : 2
  const totalSteps = mode === 'recover-phone' ? 1 : 3

  return (
    <div className="login-card">
      <div className="brand">
        <div className="brand-mark">w</div>
        <span className="brand-word">wabbit</span>
      </div>

      {totalSteps > 1 && (
        <div className="steps" aria-hidden="true">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`step ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      )}

      <h1>{heading}</h1>
      <p className="subhead">{subhead}</p>

      {mode === 'recover-phone' && (
        <form onSubmit={submitLostPhone}>
          <label>Recovery phrase (24 words)</label>
          <textarea
            value={mnemonic}
            onChange={e => setMnemonic(e.target.value)}
            rows={4}
            placeholder="word1 word2 word3 …"
            autoFocus
            required
          />
          <label>Password</label>
          <div className="password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
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
          <button type="submit" disabled={loading}>
            {loading ? 'Recovering…' : 'Recover account'}
          </button>
        </form>
      )}

      {mode === 'recover-password' && step === 'phone' && (
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

      {mode === 'recover-password' && step === 'code' && (
        <form onSubmit={submitCode}>
          <label>6-digit code</label>
          <input
            type="text"
            inputMode="numeric"
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
          <button type="button" className="link" onClick={() => setStep('phone')}>
            Use a different number
          </button>
        </form>
      )}

      {mode === 'recover-password' && step === 'newpw' && (
        <form onSubmit={submitMnemonicAndNewPassword}>
          <label>Recovery phrase (24 words)</label>
          <textarea
            value={mnemonic}
            onChange={e => setMnemonic(e.target.value)}
            rows={4}
            placeholder="word1 word2 word3 …"
            autoFocus
            required
          />
          <label>New password</label>
          <div className="password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
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
          <label>Confirm new password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Updating…' : 'Reset password'}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      <div className="row-links recovery-links">
        <button type="button" className="link" onClick={onCancel}>
          ← Back to sign in
        </button>
      </div>
    </div>
  )
}
