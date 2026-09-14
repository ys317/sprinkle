import { useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { Link, useParams } from 'react-router-dom'
import { COOK_MINT, explorerAddress, explorerTx, shortAddr } from '../lib/chain'
import { primaryName } from '../lib/names'
import { fetchReceipt, mainTransfer, type Receipt } from '../lib/receipt'
import { fetchTokenRegistry, formatAmount, formatUsd, type TokenInfo } from '../lib/tokens'

export function ReceiptPage() {
  const { sig = '' } = useParams()
  const { connection } = useConnection()
  const [receipt, setReceipt] = useState<Receipt | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchTokenRegistry().then(setTokens)
  }, [])

  useEffect(() => {
    setReceipt(undefined)
    setError('')
    if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig)) {
      setError('That is not a valid transaction signature.')
      setReceipt(null)
      return
    }
    let alive = true
    fetchReceipt(connection, sig)
      .then((r) => alive && setReceipt(r))
      .catch((e) => alive && (setError(e instanceof Error ? e.message : String(e)), setReceipt(null)))
    return () => {
      alive = false
    }
  }, [connection, sig])

  // Reverse-resolve .cook names for the parties.
  useEffect(() => {
    if (!receipt) return
    const t = mainTransfer(receipt)
    const addrs = [...new Set([t?.from, t?.to, receipt.feePayer].filter((x): x is string => !!x))]
    let alive = true
    Promise.all(addrs.map(async (a) => [a, await primaryName(connection, new PublicKey(a)).catch(() => null)] as const)).then((pairs) => {
      if (!alive) return
      const m: Record<string, string> = {}
      for (const [a, n] of pairs) if (n) m[a] = n
      setNames(m)
    })
    return () => {
      alive = false
    }
  }, [connection, receipt])

  if (receipt === undefined) return <div className="card narrow muted">Reading transaction from Cookie Chain…</div>
  if (receipt === null) {
    return (
      <div className="card narrow">
        <h1>Receipt not found</h1>
        <p className="err">{error || 'This signature is not on Cookie Chain (yet). It may still be confirming, or it may belong to another network.'}</p>
        <a className="btn btn-ghost" href={explorerTx(sig)} target="_blank" rel="noreferrer">
          Check on Cookiescan
        </a>
      </div>
    )
  }

  const t = mainTransfer(receipt)
  const token = t ? tokens.find((x) => x.mint === t.mint) : undefined
  const symbol = token?.symbol ?? (t?.mint === COOK_MINT ? 'COOK' : t ? shortAddr(t.mint) : '')
  const usd = t && token?.priceUsd ? (Number(t.rawAmount) / 10 ** t.decimals) * token.priceUsd : null
  const when = receipt.blockTime ? new Date(receipt.blockTime * 1000) : null
  const party = (a: string | null) =>
    a ? (
      <>
        {names[a] && <strong>{names[a]} </strong>}
        <a href={explorerAddress(a)} target="_blank" rel="noreferrer" className="mono">
          {shortAddr(a, 6)}
        </a>
      </>
    ) : (
      <span className="muted">unknown</span>
    )

  return (
    <div className="card narrow receipt">
      <div className={`stamp ${receipt.ok ? 'ok' : 'bad'}`}>{receipt.ok ? 'Confirmed on Cookie Chain' : 'Failed on-chain'}</div>
      {t ? (
        <>
          <div className="amount-big">
            {formatAmount(t.rawAmount, t.decimals)} <span className="sym">{symbol}</span>
          </div>
          {usd !== null && <div className="muted">≈ {formatUsd(usd)} at current Cookiescan price</div>}
          <dl className="summary receipt-grid">
            <dt>From</dt>
            <dd>{party(t.from)}</dd>
            <dt>To</dt>
            <dd>{party(t.to)}</dd>
            {receipt.sprinkle && (
              <>
                <dt>Label</dt>
                <dd>{receipt.label || <span className="muted">tip</span>}</dd>
              </>
            )}
            {!receipt.sprinkle && receipt.memo && (
              <>
                <dt>Memo</dt>
                <dd className="mono">{receipt.memo}</dd>
              </>
            )}
            <dt>When</dt>
            <dd>{when ? when.toLocaleString() : '—'}</dd>
            <dt>Slot</dt>
            <dd className="mono">{receipt.slot.toLocaleString()}</dd>
            <dt>Network fee</dt>
            <dd>{formatAmount(BigInt(receipt.feeLamports), 9)} COOK</dd>
            <dt>Signature</dt>
            <dd className="mono break">{receipt.signature}</dd>
          </dl>
        </>
      ) : (
        <p className="muted">This transaction contains no token or COOK transfer.</p>
      )}
      {receipt.transfers.length > 1 && (
        <details className="muted small">
          <summary>{receipt.transfers.length} transfers in this transaction</summary>
          <ul>
            {receipt.transfers.map((x, i) => {
              const tk = tokens.find((y) => y.mint === x.mint)
              return (
                <li key={i} className="mono">
                  {formatAmount(x.rawAmount, x.decimals)} {tk?.symbol ?? (x.mint === COOK_MINT ? 'COOK' : shortAddr(x.mint))} {x.from ? shortAddr(x.from) : '?'} → {shortAddr(x.to)}
                </li>
              )
            })}
          </ul>
        </details>
      )}
      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={() => navigator.clipboard.writeText(window.location.href).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
        >
          {copied ? 'Copied!' : 'Copy receipt link'}
        </button>
        <a className="btn btn-ghost" href={explorerTx(receipt.signature)} target="_blank" rel="noreferrer">
          View on Cookiescan
        </a>
        {t && (
          <Link className="btn btn-ghost" to={`/?to=${encodeURIComponent(names[t.to] ?? t.to)}${t.mint !== COOK_MINT ? `&mint=${t.mint}` : ''}`}>
            Pay {names[t.to] ?? shortAddr(t.to)} again
          </Link>
        )}
      </div>
      <p className="muted small">
        Every field above was read from <code>rpc.cookiescan.io</code> when you opened this page. Nothing is stored by Sprinkle, so this receipt cannot be edited after the fact.
      </p>
    </div>
  )
}
