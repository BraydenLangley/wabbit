# wabbit

A hosted [BRC-100](https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md)
wallet that integrators embed via a cross-origin iframe — like Stripe Elements,
but for Bitcoin SV wallet operations.

> ## ⚠️ Proof of concept — research & development only
>
> **This codebase is a research prototype, not a product.** It is published to
> share the architecture and to make the structural security limitations of
> doing BRC-100 wallet auth on the open web visible and discussable.
>
> - **Do not** use it to protect real funds, real identities, or anything you
>   would mind losing.
> - **Do not** deploy it as the auth surface for production users.
> - **Do** read the [Security limitations](#security-limitations) section in full
>   before running, forking, or integrating anything here.
>
> No warranty, no support, no security commitments. Use at your own risk.

## What's in here

This repo is a small monorepo of five sibling packages:

| Package             | Role (Stripe analogy)                                          |
| ------------------- | -------------------------------------------------------------- |
| `wabbit/`           | Wallet iframe host — holds keys, runs auth, enforces permissions. *(Stripe's hosted iframes.)* |
| `wabbit-sdk/`       | Framework-agnostic loader. Mounts the iframe, exposes a `WalletInterface` proxy. *(`@stripe/stripe-js`.)* |
| `wabbit-react/`     | React bindings — `<WabbitProvider>`, `useWabbit()`, `<WabbitLoginButton>`. *(`@stripe/react-stripe-js`.)* |
| `wabbit-demo-todo/` | Example integrator app: encrypted on-chain todo list. *(A merchant site.)* |
| `wabbit-stack/`     | docker-compose + Cloud Build configs to run the lot.           |

## How it works

```
┌────────────────────────────────────────┐    ┌──────────────────────────────────────┐
│  https://your-site.com                 │    │  https://wallet.wabbit.io            │
│                                        │    │  (separate origin)                   │
│  ┌──────────────────────────────────┐  │    │  ┌────────────────────────────────┐  │
│  │  React app                       │  │    │  │  wabbit iframe                 │  │
│  │  ─ <WabbitProvider>              │  │    │  │  ─ holds primary key + UMP     │  │
│  │  ─ useWabbit() → WalletInterface │  │◀───┼──┤    token in memory             │  │
│  │     .createAction(), .encrypt()  │  │    │  │  ─ owns the auth UI            │  │
│  │     etc. — all proxied           │  │    │  │  ─ renders permission prompts  │  │
│  └────────────┬─────────────────────┘  │    │  └────────────────────────────────┘  │
└───────────────┼────────────────────────┘    └──────────────▲───────────────────────┘
                │                                            │
                │  postMessage RPC                           │  TLS to backend services
                │  { kind: 'call', method, args }            │  (WAB, storage, overlay)
                ▼                                            ▼
        cross-origin trust                         wab.babbage.systems
        boundary (browser-                         storage.babbage.systems
        enforced)                                  ARC, overlay network
```

The integrator's site never sees the user's password, primary key, OTP, or
recovery phrase. Those only ever exist inside the iframe at `wallet.wabbit.io`.
Calls to the [BRC-100 `WalletInterface`][brc100] (`createAction`, `encrypt`,
`listOutputs`, etc.) are forwarded by `postMessage` and answered by the iframe.

[brc100]: https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md

### Auth flow

Built on the BSV [`@bsv/wallet-toolbox-client`](https://www.npmjs.com/package/@bsv/wallet-toolbox-client):

1. **Phone + Twilio OTP** identifies the user via the WAB (Wallet Authentication
   Backend at `wab.babbage.systems`).
2. **Password** — combined with material from WAB to derive the user's primary
   key. New users get a **24-word recovery phrase** they must save.
3. **UMP** (User Management Protocol) tokens are published to the BSV overlay
   network so the same identity can be looked up across devices.
4. **Snapshot** of the unlocked wallet state is stored in the iframe's
   `localStorage`, so reloading doesn't require re-auth (until idle lock fires
   or the user signs out).

### Permission prompts

Every action requested by an integrator's site that touches the user's account
goes through `WalletPermissionsManager`, which raises one of four prompt types:

- **Protocol** — the app wants to encrypt/sign for some named protocol
- **Basket** — the app wants to read or write items in a named output basket
- **Spending** — the app wants to spend N sats
- **Certificate** — the app wants to verify a piece of identity

The iframe renders the prompt; the integrator's site can't bypass it.

## Quick start (local dev)

Two terminals:

```bash
# Terminal 1 — wallet iframe host
cd wabbit
npm install
npm run dev          # http://127.0.0.1:5173

# Terminal 2 — demo todo app
cd wabbit-demo-todo
npm install
npm run dev          # http://127.0.0.1:5174
```

Open <http://127.0.0.1:5174>, click **Sign in with wabbit**, follow phone →
OTP → password. After auth the iframe disappears and you can add tasks. It
reappears on every permission prompt.

The wallet is also browsable on its own at <http://127.0.0.1:5173>.

### Docker

```bash
cd wabbit-stack
docker compose up --build
# wabbit → http://127.0.0.1:5173
# demo  → http://127.0.0.1:5174
```

## Integrating wabbit into your own React site

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

  // Standard BRC-100 calls — no key handling on your site.
  const out = await wallet.encrypt({ plaintext, protocolID, keyID })
}
```

For framework-agnostic use, drop down to `wabbit-sdk`:

```ts
import { createWabbit } from 'wabbit-sdk'
const handle = await createWabbit({ origin: 'https://wallet.wabbit.io' })
await handle.login()
await handle.wallet.createAction({ /* ... */ })
```

## Configuration

`wabbit/` (Vite envs, baked at build time):

| Env                            | Default                            | Purpose                                                            |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------ |
| `VITE_WAB_URL`                 | `https://wab.babbage.systems`      | WAB backend (Twilio OTP + UMP discovery)                           |
| `VITE_STORAGE_URL`             | `https://storage.babbage.systems`  | Wallet storage backend                                             |
| `VITE_CHAIN`                   | `main`                             | `main` or `test`                                                   |
| `VITE_ADMIN_ORIGINATOR`        | `admin.wabbit.local`               | Originator string for the wallet's own admin operations            |
| `VITE_ALLOWED_PARENT_ORIGINS`  | *(empty — permissive)*             | Comma-separated origin allowlist for `postMessage`. **Set this in production.** |

`wabbit-demo-todo/`:

| Env                  | Default                | Purpose                          |
| -------------------- | ---------------------- | -------------------------------- |
| `VITE_WABBIT_ORIGIN` | `http://127.0.0.1:5173` | Where to load the wabbit iframe. |

## Security limitations

> This is the part to read closely. Wabbit can absolutely be a nice user
> experience for low-stakes BRC-100 apps. It is not, by design, a substitute for
> an OS-level wallet, and the gap is real.

### 1. Phone-number harvesting → UMP discovery

The BRC-100 / UMP authentication flow starts with `phone number → Twilio OTP`.
A malicious site that successfully convinces a user to enter their phone number
and OTP can:

1. Drive the same `WABClient.startAuth()` / `completeAuth()` calls themselves,
   producing the user's authenticated WAB primary-key material.
2. Use that material to look up the user's UMP token on the public BSV overlay
   network (the token is broadcast there by design).
3. Begin offline password-cracking against that token.

Twilio OTP is a *liveness* check, not an authentication secret. Anyone with
the user's phone number who can socially engineer a code out of them gets to
the same starting point a legitimate sign-in does.

### 2. Password drain

If a malicious site asks for the user's wabbit password (perhaps a phishing UI
that *looks* like the wabbit iframe), the attacker can:

1. Sign into the user's actual wabbit wallet using their own session.
2. Call `listOutputs` and `createAction` to drain funds.
3. Decrypt anything the user previously encrypted with that wallet — including
   private data stored by other apps.

The hosted-iframe pattern reduces this risk **only** if users reliably notice
the difference between a real wabbit iframe and a clone. Browsers do not give
iframes strong, recognisable chrome the way they do for the address bar, so
this is a UX-by-convention defence.

### 3. Cross-app identity compromise

There is one primary key and one password protecting the user's full BRC-100
identity. A breach in one app is a breach across **all** of their apps —
encrypted notes, payments, certificates, the lot. Compare to a model where
each app gets its own scoped credential and a compromise stays local.

### 4. The iframe is a UX boundary, not a strong trust boundary

`postMessage` origin checks (the `VITE_ALLOWED_PARENT_ORIGINS` allowlist, the
locked-parent-origin pattern in `PostMessageHost`) prevent unrelated origins
from impersonating a trusted integrator *over an existing iframe*. They do not
prevent a hostile origin from spinning up its **own** wabbit iframe inside its
own page, which is what the harvesting attacks above rely on. The browser's
same-origin policy is doing the cryptographic isolation; everything else is
convention.

### What would actually fix this

The structural fix is **OS-level wallet integration**, where the
`WalletInterface` is provided by the operating system or a privileged
extension, not by a website. In that world:

- Keys never leave the OS-controlled trust boundary.
- The OS — not a website — owns the permission UI, branded with system chrome
  the user has been trained to recognise.
- Users **cannot** be tricked into entering wallet credentials on a website,
  because there is no website-level credential to enter.
- Apps make scoped requests; the OS approves or denies; that's it.

This is the direction projects like the Babbage Desktop wallet, the Authsig
browser extensions, and ongoing platform integration efforts are pointed at.
Wabbit is a useful prototype and a workable UX for trusted in-house apps; it
is not the right surface for the user's primary cross-app identity until OS
integration is widespread.

In the meantime, **don't run wabbit unmodified in front of valuable
identities**, and treat the demos here as exactly that: demos.

## Layout

```
.
├── wabbit/             # wallet iframe host (this directory's README)
├── wabbit-sdk/         # framework-agnostic loader (publishable)
├── wabbit-react/       # React bindings (publishable)
├── wabbit-demo-todo/   # example integrator
└── wabbit-stack/       # docker-compose + Cloud Build
```

## License

[Open BSV License v4](./LICENSE) © Peer-to-peer Privacy Systems Research, LLC.

Published as a proof of concept and PSA — read the
[Security limitations](#security-limitations) section before deploying this in
front of valuable identities.
