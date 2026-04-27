import { useState, type FormEvent } from 'react'
import { useWallet } from './WalletContext'

export const Account = () => {
  const { logout, changePassword, getRecoveryMnemonic, regenerateRecoveryKey } = useWallet()
  const [section, setSection] = useState<'home' | 'change-pw' | 'view-phrase'>('home')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phrase, setPhrase] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submitChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPw) {
      setError("Passwords don't match")
      return
    }
    setBusy(true)
    try {
      await changePassword(newPassword)
      setNewPassword('')
      setConfirmPw('')
      setSection('home')
      setNotice('Password updated.')
    } catch (err) {
      setError((err as Error).message || 'Couldn\'t change password')
    } finally {
      setBusy(false)
    }
  }

  const viewPhrase = async () => {
    setError(null)
    setBusy(true)
    try {
      const m = await getRecoveryMnemonic()
      setPhrase(m)
      setSection('view-phrase')
    } catch (err) {
      setError((err as Error).message || 'Couldn\'t show recovery phrase')
    } finally {
      setBusy(false)
    }
  }

  const regenerate = async () => {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      await regenerateRecoveryKey()
      setNotice('New recovery phrase generated. Make sure you saved it.')
      setPhrase(null)
      setSection('home')
    } catch (err) {
      setError((err as Error).message || 'Couldn\'t generate a new phrase')
    } finally {
      setBusy(false)
    }
  }

  const heading =
    section === 'change-pw'
      ? 'Change password'
      : section === 'view-phrase'
      ? 'Your recovery phrase'
      : 'Account'

  const subhead =
    section === 'change-pw'
      ? 'Choose a new password. You\'ll use this the next time you sign in.'
      : section === 'view-phrase'
      ? 'Keep these 24 words safe. Anyone with them and your password can sign in.'
      : "You're signed in."

  return (
    <div className="login-card">
      <div className="brand">
        <div className="brand-mark">w</div>
        <span className="brand-word">wabbit</span>
      </div>
      <h1>{heading}</h1>
      <p className="subhead">{subhead}</p>

      {section === 'home' && (
        <>
          <div className="account-actions">
            <button className="ghost" onClick={() => setSection('change-pw')}>
              Change password
            </button>
            <button className="ghost" onClick={viewPhrase} disabled={busy}>
              {busy ? 'Loading…' : 'Show recovery phrase'}
            </button>
            <button className="ghost" onClick={regenerate} disabled={busy}>
              Generate new recovery phrase
            </button>
            <button className="secondary" onClick={logout}>
              Sign out
            </button>
          </div>
        </>
      )}

      {section === 'change-pw' && (
        <form onSubmit={submitChangePassword}>
          <label>New password</label>
          <div className="password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoFocus
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
          <button type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Save'}
          </button>
          <button type="button" className="link" onClick={() => setSection('home')}>
            Cancel
          </button>
        </form>
      )}

      {section === 'view-phrase' && phrase && (
        <>
          <div className="mnemonic-grid">
            {phrase.split(' ').map((w, i) => (
              <div key={i} className="mnemonic-word">
                <span className="mnemonic-index">{i + 1}</span>
                <span className="mnemonic-text">{w}</span>
              </div>
            ))}
          </div>
          <div className="mnemonic-actions">
            <button
              className="ghost"
              onClick={() => {
                navigator.clipboard?.writeText(phrase).catch(() => {})
                setNotice('Copied.')
              }}
            >
              Copy
            </button>
            <button
              className="ghost"
              onClick={() => {
                const blob = new Blob(
                  [`wabbit account recovery phrase\n\n${phrase}\n`],
                  { type: 'text/plain' }
                )
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `wabbit-recovery-${new Date().toISOString().slice(0, 10)}.txt`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              }}
            >
              Download
            </button>
          </div>
          <button type="button" className="link" onClick={() => setSection('home')}>
            ← Back
          </button>
        </>
      )}

      {notice && <p className="muted" style={{ marginTop: '1rem' }}>{notice}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
