# wabbit (wallet iframe host)

> ⚠️ **Proof of concept — research & development only.** Not for production use.
> See the [top-level README](../README.md#security-limitations) for the full
> security caveats before running or forking this.

The wabbit wallet itself — a Vite + React app that runs at its own origin
(e.g. `https://wallet.wabbit.io`) and is embedded as a sandboxed iframe by
integrator sites.

See the [top-level README](../README.md) for architecture and the rest of the
stack.

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

## Configuration

Vite envs (baked at build time):

| Env                           | Default                            | Purpose                                                       |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `VITE_WAB_URL`                | `https://wab.babbage.systems`      | WAB backend (Twilio OTP + UMP discovery)                      |
| `VITE_STORAGE_URL`            | `https://storage.babbage.systems`  | Wallet storage backend                                        |
| `VITE_CHAIN`                  | `main`                             | `main` or `test`                                              |
| `VITE_ADMIN_ORIGINATOR`       | `admin.wabbit.local`               | Originator string for the wallet's own admin operations       |
| `VITE_ALLOWED_PARENT_ORIGINS` | *(empty — permissive)*             | Comma-separated origin allowlist for `postMessage`. **Set in production.** |

## Source layout

- `src/WalletContext.tsx` — wires up `WalletAuthenticationManager`,
  `WalletPermissionsManager`, `OverlayUMPTokenInteractor`, and the password /
  recovery-key UI gates.
- `src/Login.tsx`, `src/RecoveryLogin.tsx` — phone → OTP → password flows.
- `src/PostMessageHost.tsx` — postMessage RPC bridge to integrator sites
  (only mounted when running embedded).
- `src/PermissionModal.tsx`, `src/RecoveryKeyModal.tsx` — permission and
  recovery-phrase prompts.
- `src/Account.tsx` — signed-in account management (change password, view /
  rotate recovery phrase, sign out).
