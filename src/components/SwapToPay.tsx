// "Pay with another token": swaps one of the payer's tokens into the requested one via the Candy Shop
// aggregator, then hands control back to the pay flow. Two wallet prompts total (swap, then pay).
import { useEffect, useState } from 'react'
import { PublicKey, type Connection, type Transaction, type VersionedTransaction } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { COOK_MINT, explorerTx, shortAddr } from '../lib/chain'
import { buildSwapTx, quoteForOutput, routeLabel, type OutputQuote } from '../lib/candyshop'
import { explainWalletError, pollConfirmation } from '../lib/pay'
import { fetchTokenRegistry, formatAmount, type TokenInfo } from '../lib/tokens'

interface Holding {
  mint: string
  raw: bigint
  decimals: number
  symbol: string
}

type Stage = 'idle' | 'quoting' | 'building' | 'signing' | 'sending' | 'confirming' | 'done' | 'failed'

/** Keep a little native COOK back for the swap fee and the payment fee that follows. */
const COOK_RESERVE = 20_000_000n // 0.02 COOK

export function SwapToPay(props: {
  connection: Connection
  payer: PublicKey
  target: TokenInfo
  shortfallRaw: bigint
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>
  onSwapped: (signature: string) => void
}) {
  const { connection, payer, target, shortfallRaw, signTransaction, onSwapped } = props
  const [holdings, setHoldings] = useState<Holding[] | null>(null)
  const [from, setFrom] = useState<string>('')
  const [quote, setQuote] = useState<OutputQuote | null>(null)
  const [quoteErr, setQuoteErr] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [sig, setSig] = useState('')
  const [err, setErr] = useState('')

  // What can the payer swap from?
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [registry, lamports, spl, t22] = await Promise.all([
        fetchTokenRegistry(),
        connection.getBalance(payer, 'confirmed'),
        connection.getParsedTokenAccountsByOwner(payer, { programId: TOKEN_PROGRAM_ID }, 'confirmed').catch(() => ({ value: [] })),
        connection.getParsedTokenAccountsByOwner(payer, { programId: TOKEN_2022_PROGRAM_ID }, 'confirmed').catch(() => ({ value: [] })),
      ])
      const sym = (mint: string) => registry.find((t) => t.mint === mint)?.symbol ?? shortAddr(mint)
      const list: Holding[] = []
      if (BigInt(lamports) > COOK_RESERVE) list.push({ mint: COOK_MINT, raw: BigInt(lamports) - COOK_RESERVE, decimals: 9, symbol: 'COOK' })
      for (const acc of [...spl.value, ...t22.value]) {
        const info = acc.account.data.parsed?.info
        const amt = BigInt(info?.tokenAmount?.amount ?? '0')
        if (amt > 0n) list.push({ mint: info.mint, raw: amt, decimals: info.tokenAmount.decimals, symbol: sym(info.mint) })
      }
      const usable = list.filter((h) => h.mint !== target.mint)
      if (!alive) return
      setHoldings(usable)
      if (usable[0]) setFrom(usable[0].mint)
    })().catch(() => alive && setHoldings([]))
    return () => {
      alive = false
    }
  }, [connection, payer, target.mint])

  // Quote whenever the source token changes.
  useEffect(() => {
    setQuote(null)
    setQuoteErr('')
    const h = holdings?.find((x) => x.mint === from)
    if (!h) return
    let alive = true
    setStage('quoting')
    quoteForOutput({ inputMint: h.mint, outputMint: target.mint, targetOutRaw: shortfallRaw, maxInRaw: h.raw })
      .then((q) => alive && (setQuote(q), setStage('idle')))
      .catch((e) => {
        if (!alive) return
        setStage('idle')
        const msg = e instanceof Error ? e.message : String(e)
        setQuoteErr(msg === 'insufficient' ? `Not enough ${h.symbol} to cover it either.` : msg)
      })
    return () => {
      alive = false
    }
  }, [holdings, from, target.mint, shortfallRaw])

  const run = async () => {
    const h = holdings?.find((x) => x.mint === from)
    if (!h || !quote) return
    setErr('')
    try {
      setStage('building')
      const tx = await buildSwapTx(quote.route, payer)
      setStage('signing')
      const signed = await signTransaction(tx)
      setStage('sending')
      const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3 })
      setSig(signature)
      setStage('confirming')
      await pollConfirmation(connection, signature)
      setStage('done')
      onSwapped(signature)
    } catch (e) {
      setStage('failed')
      setErr(explainWalletError(e))
    }
  }

  const h = holdings?.find((x) => x.mint === from)
  const busy = stage === 'building' || stage === 'signing' || stage === 'sending' || stage === 'confirming'

  if (holdings === null) return <div className="swap-panel muted">Checking what else is in your wallet…</div>
  if (holdings.length === 0) return null

  return (
    <div className="swap-panel">
      <div className="swap-head">
        <strong>Pay with another token</strong>
        <span className="muted small">
          You are short {formatAmount(shortfallRaw, target.decimals)} {target.symbol}. Swap into it first, then pay.
        </span>
      </div>
      <div className="row align-end">
        <label className="field grow">
          <span>Swap from</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} disabled={busy}>
            {holdings.map((x) => (
              <option key={x.mint} value={x.mint}>
                {x.symbol} · {formatAmount(x.raw, x.decimals, 4)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" onClick={run} disabled={!quote || busy || stage === 'done'}>
          {stage === 'quoting'
            ? 'Quoting…'
            : busy
              ? { building: 'Building…', signing: 'Approve in wallet…', sending: 'Sending…', confirming: 'Confirming…' }[stage as 'building' | 'signing' | 'sending' | 'confirming']
              : stage === 'done'
                ? 'Swapped'
                : 'Swap & continue'}
        </button>
      </div>
      {quote && h && (
        <div className="small muted">
          ≈ {formatAmount(quote.inRaw, h.decimals, 6)} {h.symbol} → at least {formatAmount(BigInt(quote.route.minOutAmount), target.decimals, 6)} {target.symbol} via {routeLabel(quote.route)}
          {quote.route.protocolFeeBps ? ` · ${quote.route.protocolFeeBps / 100}% aggregator fee` : ''}
          {quote.route.combinedPriceImpactPct > 0.5 ? ` · ${quote.route.combinedPriceImpactPct.toFixed(2)}% price impact` : ''}
          {quote.route.lowLiquidity ? ' · low liquidity' : ''}
        </div>
      )}
      {quoteErr && <div className="err small">{quoteErr}</div>}
      {stage === 'done' && sig && (
        <div className="small">
          Swap confirmed:{' '}
          <a href={explorerTx(sig)} target="_blank" rel="noreferrer" className="mono">
            {shortAddr(sig, 8)}
          </a>
          . Your balance is updated — press Pay.
        </div>
      )}
      {stage === 'failed' && <div className="err small">{err}</div>}
    </div>
  )
}
