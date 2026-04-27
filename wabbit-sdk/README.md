# wabbit-sdk

> ⚠️ **Proof of concept — research & development only.** Not for production use.
> See the [top-level README](../README.md#security-limitations) for the full
> security caveats.

Framework-agnostic loader for the [wabbit](../wabbit) hosted wallet — like
`@stripe/stripe-js`, but it mounts a BRC-100 wallet iframe and exposes a
`WalletInterface` proxy.

```ts
import { createWabbit } from 'wabbit-sdk'

const handle = await createWabbit({ origin: 'https://wallet.wabbit.io' })
await handle.login()
await handle.wallet.createAction({ /* ... */ })
```

The returned `wallet` is a [BRC-100 `WalletInterface`][brc100]. Every method
call is forwarded over `postMessage` to the iframe; this site never touches the
user's keys, password, or recovery phrase.

## API

- `createWabbit(config)` → `Promise<WabbitHandle>`
- `handle.wallet` — the proxied `WalletInterface`
- `handle.authenticated` — current auth state
- `handle.onAuthStateChange(fn)` — subscribe to auth changes
- `handle.login()` — surface the iframe's login UI; resolves on success
- `handle.logout()` — sign out and reload the iframe
- `handle.destroy()` — remove the iframe and detach listeners

[brc100]: https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md
