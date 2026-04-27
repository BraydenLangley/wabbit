import { useWallet, type PermissionRequest } from './WalletContext'

const originLabel = (origin: string) => {
  try {
    return new URL(origin).host || origin
  } catch {
    return origin
  }
}

const originInitial = (label: string): string =>
  (label.replace(/^www\./, '')[0] || '?').toUpperCase()

// Translate wallet-level permission types to user-facing language without blockchain jargon.
const describe = (r: PermissionRequest): { title: string; detail: string; isPayment: boolean } => {
  const app = originLabel(r.originator)
  switch (r.type) {
    case 'protocol': {
      const protoName = Array.isArray(r.protocolID)
        ? (r.protocolID as [number, string])[1]
        : 'private data'
      return {
        title: `Allow ${app}?`,
        detail: `${app} wants to store and read private data in your account for "${protoName}".`,
        isPayment: false,
      }
    }
    case 'basket':
      return {
        title: `Allow ${app}?`,
        detail: `${app} wants to manage items saved in your account${
          r.basket ? ` (${r.basket})` : ''
        }.`,
        isPayment: false,
      }
    case 'spending':
      return {
        title: 'Confirm payment',
        detail: `${app} wants to send ${(r.spending?.satoshis ?? 0).toLocaleString()} sats from your account.`,
        isPayment: true,
      }
    case 'certificate':
      return {
        title: `Allow ${app}?`,
        detail: `${app} wants to verify your identity.`,
        isPayment: false,
      }
  }
}

export const PermissionModal = () => {
  const { pendingRequests, grantRequest, denyRequest } = useWallet()
  if (pendingRequests.length === 0) return null
  const req = pendingRequests[0]
  const { title, detail, isPayment } = describe(req)
  const host = originLabel(req.originator)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>{title}</h2>

        <div className="origin-card">
          <div className="origin-avatar">{originInitial(host)}</div>
          <div className="origin-text">
            <div className="origin-name">{host}</div>
            <div className="origin-meta">is requesting access</div>
          </div>
        </div>

        <p className="modal-detail">{detail}</p>
        {req.reason && <p className="modal-reason">{req.reason}</p>}

        <div className="modal-actions">
          <button className="secondary" onClick={() => denyRequest(req.requestID)}>
            Don't allow
          </button>
          {!isPayment && (
            <button className="ghost" onClick={() => grantRequest(req.requestID, true)}>
              Just this once
            </button>
          )}
          <button onClick={() => grantRequest(req.requestID, isPayment)}>
            {isPayment ? 'Pay' : 'Allow'}
          </button>
        </div>

        {pendingRequests.length > 1 && (
          <p className="modal-queue">+{pendingRequests.length - 1} more pending</p>
        )}
      </div>
    </div>
  )
}
