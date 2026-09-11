# Submission kit — Create an App on Cookie Chain (Superteam Earn)

Listing: https://earn.superteam.fun/listing/create-an-app-on-cookie-chain-app
Deadline: 2026-09-22 21:59 UTC

## Superteam Earn form answers

- **GitHub repository:** https://github.com/ys317/sprinkle
- **Live application URL:** https://sprinkle-ten.vercel.app
- **Relevant addresses:** No custom program deployed. The app composes genesis programs on Cookie Chain:
  System `11111111111111111111111111111111`, SPL Token `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`,
  Token-2022 `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`, ATA `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`,
  Memo `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`. Example payment tx: <PASTE SIGNATURE AFTER TEST PAYMENT>

## X thread (post from your account, then share in t.me/TheCookieNetChain)

**1/**
Shipped Sprinkle 🍪 — payment links, tip jars and a receipts dashboard on @TheCookieChain.

No backend. No accounts. No custody. Just your Nightly wallet and the Cookie Chain RPC.

👉 https://sprinkle-ten.vercel.app
🧵

**2/**
How it works:
1. Paste your address, pick COOK or any Cookie Chain token, set an amount (or leave it open as a tip jar), add a label.
2. You get a link + QR. Everything lives in the URL, so it never expires and nothing is stored anywhere.

**3/**
The payer opens the link, connects Nightly, sees their balance and the USD estimate, and hits Pay.

The tx is simulated first (readable errors instead of wallet rejections), signed in the wallet, broadcast to rpc.cookiescan.io, and confirmed with live stage updates + explorer link. Sub-second finality makes this feel instant.

**4/**
Every payment writes a `sprinkle:v1:<label>` memo on-chain. The Received tab reads your history straight from the chain, groups payments by label, totals them in USD via Cookiescan prices, and charts them per day. Works for any address, no login.

**5/**
Under the hood: SystemProgram for COOK, idempotent ATA create + transferChecked for SPL / Token-2022, Memo program, Compute Budget. Token list + prices from api.cookiescan.io.

One gotcha for builders: wallet-standard maps unknown RPCs to solana:mainnet, so sign locally and broadcast yourself.

**6/**
No COOK yet? Bridge from Solana in seconds at hyperlane.cookiescan.io — the pay page links you there when your balance is empty.

Source (MIT): https://github.com/ys317/sprinkle
Built for the Cookie Chain bounty on @SuperteamEarn.

## Telegram message

Hey all — built Sprinkle for the cApp bounty: payment links + tip jars + receipts dashboard, fully client-side on Cookie Chain. Live at https://sprinkle-ten.vercel.app, thread here: <X THREAD URL>. Feedback welcome!
