import { useMemo, useState } from 'react'
import { useWallet } from './WalletContext'

export const RecoveryKeyModal = () => {
  const { pendingRecoveryKey } = useWallet()
  const [revealed, setRevealed] = useState(false)
  const [aff1, setAff1] = useState(false)
  const [aff2, setAff2] = useState(false)
  const [aff3, setAff3] = useState(false)
  const [copied, setCopied] = useState(false)

  const words = useMemo(() => pendingRecoveryKey?.mnemonic.split(' ') ?? [], [pendingRecoveryKey])

  if (!pendingRecoveryKey) return null

  const canConfirm = aff1 && aff2 && aff3
  const mnemonic = pendingRecoveryKey.mnemonic

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const doDownload = () => {
    const blob = new Blob(
      [
        `wabbit account recovery phrase\n` +
          `===============================\n\n` +
          `${mnemonic}\n\n` +
          `Keep this somewhere safe. If you ever lose access to your phone or forget ` +
          `your password, you'll need these 24 words to get back into your account.\n`,
      ],
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
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-wide">
        <div className="brand" style={{ marginBottom: '1rem' }}>
          <div className="brand-mark">w</div>
          <span className="brand-word">wabbit</span>
        </div>
        <h2>Save your recovery phrase</h2>
        <p className="modal-detail">
          If you ever lose your phone or forget your password, these 24 words are how you
          get back into your account. Save them somewhere safe — a password manager,
          printed and filed, or wherever you keep important documents.
        </p>

        {!revealed && (
          <button className="ghost" onClick={() => setRevealed(true)} style={{ marginTop: '1rem' }}>
            Show my recovery phrase
          </button>
        )}

        {revealed && (
          <>
            <div className="mnemonic-grid">
              {words.map((w, i) => (
                <div key={i} className="mnemonic-word">
                  <span className="mnemonic-index">{i + 1}</span>
                  <span className="mnemonic-text">{w}</span>
                </div>
              ))}
            </div>

            <div className="mnemonic-actions">
              <button className="ghost" onClick={doCopy}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
              <button className="ghost" onClick={doDownload}>
                Download
              </button>
            </div>

            <div className="affirmations">
              <label>
                <input type="checkbox" checked={aff1} onChange={e => setAff1(e.target.checked)} />
                I've saved my recovery phrase somewhere safe.
              </label>
              <label>
                <input type="checkbox" checked={aff2} onChange={e => setAff2(e.target.checked)} />
                I understand that wabbit can't recover it for me if I lose it.
              </label>
              <label>
                <input type="checkbox" checked={aff3} onChange={e => setAff3(e.target.checked)} />
                If I ever lose access to my phone or forget my password, I'll use this phrase
                right away.
              </label>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="secondary" onClick={pendingRecoveryKey.abandon}>
            Cancel
          </button>
          <button onClick={pendingRecoveryKey.confirm} disabled={!canConfirm}>
            I've saved it
          </button>
        </div>
      </div>
    </div>
  )
}
