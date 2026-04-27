import { useWabbit, WabbitLoginButton } from 'wabbit-react'
import { Todos } from './Todos'
import './App.css'

export default function App() {
  const { ready, authenticated, error, logout } = useWabbit()

  return (
    <div className="page">
      <header className="page-header">
        <div className="logo">
          <div className="logo-mark">T</div>
          <span>Todo</span>
        </div>
        <div className="header-actions">
          {authenticated && (
            <button className="link" onClick={logout}>
              Sign out
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className="error-banner">Couldn't connect: {error.message}. Try reloading.</p>
      )}

      {!ready && !error && <p className="muted" style={{ textAlign: 'center' }}>Loading…</p>}

      {ready && !authenticated && (
        <div className="card cta-card">
          <h2>Get things done</h2>
          <p>
            Sign in to create encrypted tasks that live on Bitcoin.
            Each task is locked into a tiny output you can later complete.
          </p>
          <WabbitLoginButton>Sign in with wabbit</WabbitLoginButton>
        </div>
      )}

      {authenticated && <Todos />}

      {ready && (
        <p className="footnote">
          Authentication and key handling happen inside a separate, isolated
          wallet — this site never sees your password or keys.
        </p>
      )}
    </div>
  )
}
