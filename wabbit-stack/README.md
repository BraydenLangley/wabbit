# wabbit-stack

> ⚠️ **Proof of concept — research & development only.** Not for production use.
> See the [top-level README](../README.md#security-limitations) for the full
> security caveats before deploying anything here.

Local orchestration and deploy helpers for the wabbit hosted wallet demo.

## Layout

```
Babbage/
├── wabbit/               # wallet iframe host — holds keys, enforces permissions
├── wabbit-sdk/           # framework-agnostic SDK — imperative createWabbit()
├── wabbit-react/         # React bindings — <WabbitProvider>, useWabbit(), <WabbitLoginButton>
├── wabbit-demo-todo/     # example integrator app using wabbit-react
└── wabbit-stack/         # this directory — docker-compose + deploy
```

Think of it like Stripe:

- **wabbit** is like the Stripe-hosted iframes (sensitive UI runs on the wallet's own origin)
- **wabbit-sdk** is like `@stripe/stripe-js` (thin loader that mounts the iframe and proxies calls)
- **wabbit-react** is like `@stripe/react-stripe-js` (drop-in `<Provider>` + hooks + button)
- **wabbit-demo-todo** is like a merchant site that drops in the widget

## Integrator usage (the drop-in pattern)

```tsx
// main.tsx
import { WabbitProvider } from 'wabbit-react'
<WabbitProvider origin="https://wallet.wabbit.io">
  <App />
</WabbitProvider>

// any component
import { useWabbit, WabbitLoginButton } from 'wabbit-react'
const { wallet, authenticated } = useWabbit()

if (!authenticated) return <WabbitLoginButton />
await wallet.createAction({ ... })  // routed through iframe; site never sees keys
```

## Local run (without Docker)

Two terminals:

```bash
# Terminal 1 — wallet
cd wabbit && npm run dev         # → http://127.0.0.1:5173

# Terminal 2 — demo
cd wabbit-demo-todo && npm run dev   # → http://127.0.0.1:5174
```

Open `http://127.0.0.1:5174`. Click "Sign in with wabbit" — the wabbit iframe appears, takes you through phone → OTP → password. After login it disappears; todos work. It reappears automatically whenever a permission prompt fires (create, complete, etc.).

Handy standalone URL: `http://127.0.0.1:5173` shows an account page where you can log out of the hosted wallet directly.

## Local run with Docker

```bash
cd wabbit-stack
docker compose up --build
# wabbit → http://127.0.0.1:5173
# demo  → http://127.0.0.1:5174
```

## Push to GCR

Each service has a self-contained Dockerfile:

- **wabbit** — context is `wabbit/` itself.
- **wabbit-demo-todo** — context is the parent dir so `../wabbit-sdk` and `../wabbit-react` are copyable.

```bash
# From Babbage/:

gcloud builds submit wabbit --config wabbit-stack/cloudbuild-wabbit.yaml
gcloud builds submit .      --config wabbit-stack/cloudbuild-demo.yaml

gcloud run deploy wabbit --image gcr.io/<PROJECT>/wabbit --region us-central1 --allow-unauthenticated
gcloud run deploy wabbit-demo-todo --image gcr.io/<PROJECT>/wabbit-demo-todo --region us-central1 --allow-unauthenticated \
  --set-env-vars VITE_WABBIT_ORIGIN=https://wabbit-<hash>-uc.a.run.app
```

Note: `VITE_WABBIT_ORIGIN` is baked in at build time (Vite static envs), so rebuild the demo image whenever the wallet's public URL changes. Set it via `--build-arg` in Cloud Build substitutions.

## Publishing the SDK packages

Right now `wabbit-sdk` and `wabbit-react` are linked via `file:` paths for local dev. To let third-party sites install them:

```bash
cd wabbit-sdk && npm publish
cd ../wabbit-react && npm publish   # depends on published wabbit-sdk
```

Then integrators install with `npm i wabbit-react` and point `origin` at your hosted wallet URL.
