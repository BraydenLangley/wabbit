# wabbit-demo-todo

> ⚠️ **Proof of concept — research & development only.** Demonstrates the
> wabbit hosted-wallet integration pattern. Not for production use. See the
> [top-level README](../README.md#security-limitations) for the full security
> caveats.

Example integrator app for [wabbit](../wabbit). Each task is encrypted with the
user's wallet key and locked into a 1-sat PushDrop output; completing a task
spends that output back.

## Run locally

```bash
# In one terminal — the wallet
cd ../wabbit && npm install && npm run dev   # http://127.0.0.1:5173

# In another — this app
npm install
npm run dev                                  # http://127.0.0.1:5174
```

Open <http://127.0.0.1:5174>, click **Sign in with wabbit**, authenticate, and
add a task.

## What this demo shows

- Drop-in `<WabbitProvider>` at the React root, pointing at the hosted wallet
  origin.
- `useWabbit()` returns a [BRC-100 `WalletInterface`][brc100] that proxies
  through the iframe — this app has no key handling code of its own.
- `wallet.encrypt()` + `PushDrop.lock()` to write encrypted task payloads
  on-chain.
- `wallet.createAction()` / `signAction()` to spend a task's output when it's
  completed.

[brc100]: https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md

## Configuration

| Env                  | Default                  | Purpose                          |
| -------------------- | ------------------------ | -------------------------------- |
| `VITE_WABBIT_ORIGIN` | `http://127.0.0.1:5173`  | Where to load the wabbit iframe. |

See the [top-level README](../README.md) for architecture, security
caveats, and the rest of the stack.
