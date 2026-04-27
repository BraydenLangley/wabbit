# wabbit-react

> ⚠️ **Proof of concept — research & development only.** Not for production use.
> See the [top-level README](../README.md#security-limitations) for the full
> security caveats.

React bindings for the [wabbit](../wabbit) hosted wallet — like
`@stripe/react-stripe-js`, but for a BRC-100 `WalletInterface`. Wraps
[wabbit-sdk](../wabbit-sdk) in a provider, hook, and login button.

```tsx
// main.tsx
import { WabbitProvider } from 'wabbit-react'

createRoot(document.getElementById('root')!).render(
  <WabbitProvider origin="https://wallet.wabbit.io">
    <App />
  </WabbitProvider>
)

// any component
import { useWabbit, WabbitLoginButton } from 'wabbit-react'

function MyComponent() {
  const { wallet, authenticated } = useWabbit()
  if (!authenticated) return <WabbitLoginButton />
  await wallet.encrypt({ plaintext, protocolID, keyID })
}
```

## API

- `<WabbitProvider origin>` — boots the iframe and exposes context to descendants
- `useWabbit()` → `{ ready, authenticated, wallet, login, logout, error }`
- `<WabbitLoginButton>` — drop-in "Sign in with wabbit" button

See the [demo app](../wabbit-demo-todo) for a working integration.
