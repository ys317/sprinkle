# Submission kit — Create an App on Cookie Chain (Superteam Earn)

Listing: https://earn.superteam.fun/listing/create-an-app-on-cookie-chain-app
Deadline: 2026-09-22 21:59 UTC

## Superteam Earn form answers

- **GitHub repository:** https://github.com/ys317/sprinkle
- **Live application URL:** https://sprinkle-ten.vercel.app
- **Relevant addresses:** No custom program deployed. The app composes genesis programs on Cookie Chain:
  System `11111111111111111111111111111111`, SPL Token `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`,
  Token-2022 `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`, ATA `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`,
  Memo `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`, cookie_domains (.cook names, read-only) `H43Qtq4AMQ86y7yc3YtCKZJ2QMhhnCcHyZKeFeoQn7PA`.
  Submission PR in the official registry: https://github.com/cookiechain/superteam-hackathon-submissions/pulls (ys317:sprinkle)

## X thread (each tweet ≤ 280 chars, verified)

**1/** (203 chars)
```
Shipped Sprinkle 🍪 payment links, tip jars and a receipts dashboard on @TheCookieChain.

No backend. No accounts. No custody. Just your Nightly wallet + the Cookie Chain RPC.

https://sprinkle-ten.vercel.app 🧵
```

**2/** (236 chars)
```
How it works: paste your address (or a .cook name), pick COOK or any token, set an amount or leave it open as a tip jar, add a label.

You get a link + QR. Everything lives in the URL, so it never expires and nothing is stored anywhere.
```

**3/** (259 chars)
```
Payer opens the link, connects Nightly, sees balance + USD estimate, hits Pay.

The tx is simulated first (readable errors), signed in the wallet, broadcast to rpc.cookiescan.io and confirmed with live stage updates + explorer link. Sub-second finality.
```

**4/** (235 chars)
```
Every payment writes a sprinkle:v1:<label> memo on-chain.

The Received tab reads your history straight from the chain, groups payments by label, totals in USD via Cookiescan prices, charts per day. Any address or .cook name, no login.
```

**5/** (213 chars)
```
Under the hood: SystemProgram for COOK, idempotent ATA create + transferChecked for SPL/Token-2022, Memo program.

.cook names are resolved on-chain (cookie_domains PDA) at pay time, so a payment follows the name.
```

**6/** (222 chars)
```
Builder gotcha: wallet-standard maps any unknown RPC to solana:mainnet, so Sprinkle asks the wallet only to sign and broadcasts the raw tx itself to Cookie Chain.

No COOK yet? Bridge from Solana at hyperlane.cookiescan.io
```

**7/** (128 chars)
```
Source (MIT): https://github.com/ys317/sprinkle
Live: https://sprinkle-ten.vercel.app

Built for the Cookie Chain cApp bounty on @SuperteamEarn 🍪
```

## Telegram message

Hey all — built Sprinkle for the cApp bounty: payment links + tip jars + receipts dashboard, fully client-side on Cookie Chain. Live at https://sprinkle-ten.vercel.app, thread here: https://x.com/VongLamqfeg/status/2098370526393913435. Feedback welcome!
