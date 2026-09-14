// Candy Shop swap aggregator (swap.cookiescan.io) through our same-origin path (/api/candyshop),
// which vercel.json rewrites to the aggregator at the edge (and vite.config.ts proxies in dev).
// Used for "pay with another token": the payer swaps into the requested token first, then the normal
// Sprinkle transfer runs. The aggregator only builds the transaction; the wallet signs it and we
// broadcast it to the Cookie Chain RPC ourselves.
import { PublicKey, VersionedTransaction } from '@solana/web3.js'

export interface CandySegment {
  dex: string
  poolAddress: string
  inAmount: string
  outAmount: string
  priceImpactPct: number
  programName?: string
  feeBps?: number
}
export interface CandyRoute {
  segments: CandySegment[]
  totalInAmount: string
  totalOutAmount: string
  minOutAmount: string
  combinedPriceImpactPct: number
  protocolFeeBps?: number
  protocolFeeAmount?: string
  programName?: string
  lowLiquidity?: boolean
  route: string[]
  isSplit: boolean
  isMultiHop: boolean
}

const BASE = '/api/candyshop'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
  const text = await r.text()
  if (!r.ok) throw new Error(`Aggregator ${r.status}: ${text.slice(0, 160)}`)
  return JSON.parse(text) as T
}

export async function quote(inputMint: string, outputMint: string, amountRaw: bigint, slippageBps = 100): Promise<CandyRoute> {
  const q = new URLSearchParams({ inputMint, outputMint, amount: amountRaw.toString(), slippageBps: String(slippageBps) })
  const j = await call<{ multiRoute?: CandyRoute } & Partial<CandyRoute>>(`quote/multi-route?${q}`)
  const r = (j.multiRoute ?? j) as CandyRoute
  if (!r?.minOutAmount) throw new Error('No route found for this pair.')
  return r
}

export interface OutputQuote {
  route: CandyRoute
  inRaw: bigint
}

/**
 * Find an input amount whose guaranteed output (minOutAmount, slippage already applied) covers
 * `targetOutRaw`, without exceeding `maxInRaw` (the payer's balance minus any reserve).
 * The aggregator only quotes exact-in, so this probes once for a price and then tightens.
 */
export async function quoteForOutput(args: {
  inputMint: string
  outputMint: string
  targetOutRaw: bigint
  maxInRaw: bigint
  slippageBps?: number
}): Promise<OutputQuote> {
  const { inputMint, outputMint, targetOutRaw, maxInRaw } = args
  const slippageBps = args.slippageBps ?? 100
  if (maxInRaw <= 0n) throw new Error('insufficient')

  // Probe with everything the payer has: if even that does not cover the target, stop early.
  const full = await quote(inputMint, outputMint, maxInRaw, slippageBps)
  const fullMin = BigInt(full.minOutAmount)
  if (fullMin < targetOutRaw) throw new Error('insufficient')

  // Scale down proportionally with a 1.5% cushion, then verify; widen a little on each miss.
  let inRaw = (maxInRaw * targetOutRaw * 1015n) / (fullMin * 1000n) + 1n
  if (inRaw >= maxInRaw) return { route: full, inRaw: maxInRaw }
  for (let i = 0; i < 4; i++) {
    const r = await quote(inputMint, outputMint, inRaw, slippageBps)
    if (BigInt(r.minOutAmount) >= targetOutRaw) return { route: r, inRaw }
    inRaw = (inRaw * 103n) / 100n + 1n
    if (inRaw >= maxInRaw) return { route: full, inRaw: maxInRaw }
  }
  return { route: full, inRaw: maxInRaw }
}

export async function buildSwapTx(route: CandyRoute, user: PublicKey): Promise<VersionedTransaction> {
  const j = await call<{ transactionBase64: string }>('swap-tx/multi-route', {
    method: 'POST',
    body: JSON.stringify({ multiRoute: route, userPublicKey: user.toBase58() }),
  })
  const bytes = Uint8Array.from(atob(j.transactionBase64), (c) => c.charCodeAt(0))
  // Handles both legacy and v0 payloads.
  return VersionedTransaction.deserialize(bytes)
}

export function routeLabel(r: CandyRoute): string {
  const names = [...new Set(r.segments.map((s) => s.programName ?? s.dex).filter(Boolean))]
  return names.join(' → ') || r.programName || 'Cookie Chain DEX'
}
