import { useState } from 'react'
import { WalletProvider, useWallet } from './WalletContext'
import { Login } from './Login'
import { Account } from './Account'
import { PermissionModal } from './PermissionModal'
import { PostMessageHost } from './PostMessageHost'
import { RecoveryLogin } from './RecoveryLogin'
import { RecoveryKeyModal } from './RecoveryKeyModal'
import './App.css'

type Mode = 'login' | 'recover-phone' | 'recover-password'

const isEmbedded = (() => {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('embed') === '1') return true
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

const AuthGate = () => {
  const { authenticated } = useWallet()
  const [mode, setMode] = useState<Mode>('login')

  if (authenticated) return <Account />
  if (mode === 'login') return <Login onSwitchMode={setMode} />
  return <RecoveryLogin mode={mode} onCancel={() => setMode('login')} />
}

const Embedded = () => {
  const { authenticated } = useWallet()
  const [mode, setMode] = useState<Mode>('login')

  return (
    <>
      <PostMessageHost />
      {!authenticated && mode === 'login' && <Login onSwitchMode={setMode} />}
      {!authenticated && mode !== 'login' && (
        <RecoveryLogin mode={mode} onCancel={() => setMode('login')} />
      )}
    </>
  )
}

export default function App() {
  return (
    <WalletProvider>
      <div className={`app-shell ${isEmbedded ? 'embedded' : ''}`}>
        {isEmbedded ? <Embedded /> : <AuthGate />}
        <PermissionModal />
        <RecoveryKeyModal />
      </div>
    </WalletProvider>
  )
}
