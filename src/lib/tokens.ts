// Token registry + prices from the Cookiescan API. Cached in memory for the session.
import { COOKIESCAN_API, COOK_DECIMALS, COOK_MINT, COOK_SYMBOL } from './chain'

export interface TokenInfo {
  mint: string
  symbol: string
  name: string
  decimals: number
  logo?: string
  priceUsd?: number
}

interface RegistryToken {
  mint: string
  metadata?: { name?: string; symbol?: string; logo?: string; decimals?: number }
  price?: { usd?: number | string }
  marketData?: { liquidity?: number; holderCount?: number; volume24h?: number }
}

export const COOK_TOKEN: TokenInfo = {
  mint: COOK_MINT,
  symbol: COOK_SYMBOL,
  name: 'Cookie',
  decimals: COOK_DECIMALS,
}

let registryPromise: Promise<TokenInfo[]> | null = null
let cookPricePromise: Promise<number | null> | null = null

export async function fetchCookPriceUsd(): Promise<number | null> {
  if (!cookPricePromise) {
    cookPricePromise = fetch(`${COOKIESCAN_API}/api/price/cook`)
      .then((r) => r.json())
      .then((j) => {
        const usd = j?.data?.price?.usd
        return typeof usd === 'number' && usd > 0 ? usd : null
      })
      .catch(() => null)
  }
  return cookPricePromise
}

/** Registry of tokens that have real liquidity, sorted by holders. COOK is always first. */
export async function fetchTokenRegistry(): Promise<TokenInfo[]> {
  if (!registryPromise) {
    registryPromise = (async () => {
      const cookUsd = await fetchCookPriceUsd()
      const cook = { ...COOK_TOKEN, priceUsd: cookUsd ?? undefined }
      try {
        const j = await fetch(`${COOKIESCAN_API}/api/tokens`).then((r) => r.json())
        const raw: RegistryToken[] = Array.isArray(j?.data) ? j.data : []
        const list = raw
          .filter((t) => t.mint && t.metadata?.symbol && typeof t.metadata.decimals === 'number')
          .filter((t) => (t.marketData?.holderCount ?? 0) >= 20 || (t.marketData?.liquidity ?? 0) > 0)
          .sort((a, b) => (b.marketData?.holderCount ?? 0) - (a.marketData?.holderCount ?? 0))
          .slice(0, 60)
          .map<TokenInfo>((t) => ({
            mint: t.mint,
            symbol: t.metadata!.symbol!,
            name: t.metadata!.name ?? t.metadata!.symbol!,
            decimals: t.metadata!.decimals!,
            logo: t.metadata!.logo,
            priceUsd: numberOrUndefined(t.price?.usd),
          }))
        return [cook, ...list.filter((t) => t.mint !== COOK_MINT)]
      } catch {
        return [cook]
      }
    })()
  }
  return registryPromise
}

export async function lookupToken(mint: string): Promise<TokenInfo | null> {
  if (mint === COOK_MINT) return { ...COOK_TOKEN, priceUsd: (await fetchCookPriceUsd()) ?? undefined }
  const reg = await fetchTokenRegistry()
  return reg.find((t) => t.mint === mint) ?? null
}

function numberOrUndefined(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined
}

export function formatAmount(raw: bigint, decimals: number, maxFrac = 6): string {
  const neg = raw < 0n
  const abs = neg ? -raw : raw
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  let frac = (abs % base).toString().padStart(decimals, '0').slice(0, maxFrac).replace(/0+$/, '')
  const w = whole.toLocaleString('en-US')
  return `${neg ? '-' : ''}${w}${frac ? '.' + frac : ''}`
}

export function parseAmount(text: string, decimals: number): bigint | null {
  const t = text.trim()
  if (!/^\d*(\.\d*)?$/.test(t) || t === '' || t === '.') return null
  const [w = '0', f = ''] = t.split('.')
  if (f.length > decimals) return null
  const raw = BigInt(w || '0') * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0')
  return raw > 0n ? raw : null
}

export function formatUsd(v: number): string {
  if (v >= 1) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (v >= 0.01) return `$${v.toFixed(4)}`
  return `$${v.toPrecision(3)}`
}
