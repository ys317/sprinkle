// Cookie Chain constants and shared connection.
// Everything in the app talks to the community RPC directly from the browser; there is no backend.
import { Connection, PublicKey } from '@solana/web3.js'

export const RPC_URL = 'https://rpc.cookiescan.io'
// The documented WS endpoint (wss.cookiescan.io) currently serves a certificate for a different
// hostname, so browsers refuse it. Nothing in the app subscribes over WS: confirmation and live
// updates are polled over HTTP instead.
export const EXPLORER_URL = 'https://cookiescan.io'
export const COOKIESCAN_API = 'https://api.cookiescan.io'
export const BRIDGE_URL = 'https://hyperlane.cookiescan.io'
export const SWAP_URL = 'https://swap.cookiescan.io'

// Native COOK is Solana's NATIVE_MINT identifier on this SVM chain, 9 decimals.
export const COOK_MINT = 'So11111111111111111111111111111111111111112'
export const COOK_DECIMALS = 9
export const COOK_SYMBOL = 'COOK'

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

// Every Sprinkle payment carries a memo with this prefix so the dashboard can find its own trail.
export const MEMO_PREFIX = 'sprinkle:v1:'

let _connection: Connection | null = null
export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_URL, {
      commitment: 'confirmed',
      disableRetryOnRateLimit: false,
    })
  }
  return _connection
}

export const explorerTx = (sig: string) => `${EXPLORER_URL}/tx/${sig}`
export const explorerAddress = (addr: string) => `${EXPLORER_URL}/address/${addr}`
export const explorerToken = (mint: string) => `${EXPLORER_URL}/token/${mint}`

export function shortAddr(addr: string, n = 4): string {
  return addr.length <= n * 2 + 1 ? addr : `${addr.slice(0, n)}…${addr.slice(-n)}`
}

export function isValidPubkey(s: string): boolean {
  try {
    new PublicKey(s)
    return true
  } catch {
    return false
  }
}
