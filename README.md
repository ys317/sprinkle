# Sprinkle 🍪

**Payment links, tip jars and a receipts dashboard on [Cookie Chain](https://www.cookiechain.wtf).**
No backend, no accounts, no custody. Everything runs in the browser against the community RPC.

Live: https://sprinkle-ten.vercel.app

## What it does

| Page | What happens on-chain |
| --- | --- |
| **Create link** (`/`) | Nothing yet. You pick recipient, token (COOK or any registry token), optional amount, label and message. The whole request is encoded in the URL, plus a QR code. Links never expire. |
| **Pay** (`/pay?…`) | Payer connects [Nightly](https://nightly.app), sees their balance, and sends. For COOK that is a `SystemProgram.transfer`; for SPL / Token‑2022 it is an idempotent ATA create + `transferChecked`. Every payment carries a `sprinkle:v1:<label>:<payer>` memo. The transaction is simulated first, signed by the wallet, broadcast by the page to `rpc.cookiescan.io`, and confirmed with live stage updates and an explorer link. |
| **Received** (`/dashboard`) | Reads `getSignaturesForAddress` + `getParsedTransactions` for any address or `.cook` name, extracts incoming COOK and token transfers, groups Sprinkle payments by label, shows totals (USD via Cookiescan prices), a per‑day chart and a table. Polls the newest signature every 10 s so new payments appear as they land. |

## `.cook` names

Anywhere Sprinkle asks for a recipient you can type a [`.cook` name](https://book.cookoven.xyz) instead of an address. Links can carry the name itself (`/pay?to=alice.cook`), and the pay page resolves it on-chain at payment time — a single PDA read on the `cookie_domains` program — so a payment follows the name if it is ever transferred. Names sitting in the marketplace escrow are refused rather than paid into a program account. The dashboard shows a wallet's primary name via the reverse (`["primary", owner]`) record.

## Why sign-then-send instead of the wallet's `sendTransaction`

The Wallet Standard adapter maps any RPC it does not recognise to `solana:mainnet` and asks the
wallet to broadcast there. On a custom SVM network that is the wrong chain. Sprinkle asks the
wallet only to **sign**, then broadcasts the raw transaction itself to the Cookie Chain RPC, so the
flow is deterministic no matter which network the wallet UI has selected.

## Cookie Chain integrations

- RPC: `https://rpc.cookiescan.io` (HTTP only — the documented WS endpoint currently serves a mismatched TLS certificate, so confirmation and live updates are polled)
- Token registry + prices: `https://api.cookiescan.io/api/tokens`, `/api/price/cook`
- Programs used: System, SPL Token, Token‑2022, Associated Token Account, Memo, Compute Budget, `cookie_domains` (`.cook` names, read-only)
- Explorer links: https://cookiescan.io
- Bridge hint for empty wallets: https://hyperlane.cookiescan.io

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/
```

Deploys as a static site. `vercel.json` rewrites all routes to `index.html`.

## Stack

Vite · React 19 · TypeScript · `@solana/web3.js` · `@solana/spl-token` · `@solana/wallet-adapter-*` · `qrcode`

## License

MIT
