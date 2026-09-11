import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { PublicKey } from '@solana/web3.js'
import { COOK_MINT, explorerAddress, explorerTx, shortAddr } from '../lib/chain'
import { fetchIncoming, type IncomingPayment } from '../lib/history'
import { isValidRecipient } from '../lib/link'
import { RESOLVE_ERROR_TEXT, primaryName, resolveRecipient } from '../lib/names'
import { fetchTokenRegistry, formatAmount, formatUsd, type TokenInfo } from '../lib/tokens'

export function DashboardPage() {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  const { setVisible } = useWalletModal()

  const [addrInput, setAddrInput] = useState('')
  const [owner, setOwner] = useState<PublicKey | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [resolveMsg, setResolveMsg] = useState('')
  const [payments, setPayments] = useState<IncomingPayment[]>([])
  const [scanned, setScanned] = useState(0)
  const [newestSig, setNewestSig] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [onlySprinkle, setOnlySprinkle] = useState(true)

  useEffect(() => {
    fetchTokenRegistry().then(setTokens)
  }, [])
  useEffect(() => {
    if (publicKey && !owner) setOwner(publicKey)
  }, [publicKey, owner])

  const load = useCallback(
    async (pk: PublicKey, before: string | null, reset: boolean) => {
      setLoading(true)
      setError('')
      try {
        const page = await fetchIncoming(connection, pk, { before: before ?? undefined, limit: 50 })
        setPayments((prev) => (reset ? page.payments : [...prev, ...page.payments]))
        setScanned((prev) => (reset ? page.scanned : prev + page.scanned))
        if (reset) setNewestSig(page.newestSignature)
        setCursor(page.oldestSignature)
        setExhausted(page.exhausted)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [connection],
  )

  useEffect(() => {
    if (!owner) return
    setPayments([])
    setScanned(0)
    setNewestSig(null)
    setCursor(null)
    setExhausted(false)
    setOwnerName(null)
    load(owner, null, true)
    primaryName(connection, owner).then(setOwnerName).catch(() => {})
  }, [owner, load, connection])

  const onLoadInput = async () => {
    setResolveMsg('')
    const r = await resolveRecipient(connection, addrInput)
    if ('error' in r) setResolveMsg(RESOLVE_ERROR_TEXT[r.error])
    else setOwner(r.pubkey)
  }

  // Live updates: poll the address's newest signature every 10s and reload when it changes.
  useEffect(() => {
    if (!owner) return
    let alive = true
    const tick = async () => {
      try {
        const [latest] = await connection.getSignaturesForAddress(owner, { limit: 1 }, 'confirmed')
        if (alive && latest && !latest.err && latest.signature !== newestSig) load(owner, null, true)
      } catch {
        /* transient RPC hiccup; try again next tick */
      }
    }
    const id = setInterval(tick, 10_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [connection, owner, load, newestSig])

  const visible = useMemo(() => (onlySprinkle ? payments.filter((p) => p.sprinkle) : payments), [payments, onlySprinkle])

  const totals = useMemo(() => {
    const byMint = new Map<string, { raw: bigint; decimals: number; count: number }>()
    for (const p of visible) {
      const cur = byMint.get(p.mint) ?? { raw: 0n, decimals: p.decimals, count: 0 }
      cur.raw += p.rawAmount
      cur.count += 1
      byMint.set(p.mint, cur)
    }
    return [...byMint.entries()].map(([mint, v]) => {
      const t = tokens.find((x) => x.mint === mint)
      const usd = t?.priceUsd ? (Number(v.raw) / 10 ** v.decimals) * t.priceUsd : null
      return { mint, symbol: t?.symbol ?? shortAddr(mint), ...v, usd }
    })
  }, [visible, tokens])

  const totalUsd = totals.reduce((s, t) => s + (t.usd ?? 0), 0)

  const byLabel = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of visible) m.set(p.label || '(no label)', (m.get(p.label || '(no label)') ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [visible])

  const daily = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of visible) {
      if (!p.blockTime) continue
      const d = new Date(p.blockTime * 1000).toISOString().slice(0, 10)
      m.set(d, (m.get(d) ?? 0) + 1)
    }
    const days = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
    const max = Math.max(1, ...days.map((d) => d[1]))
    return { days, max }
  }, [visible])

  return (
    <div className="stack">
      <section className="card">
        <h1>Received payments</h1>
        <p className="lede">
          Read directly from Cookie Chain history for any address. Payments made through Sprinkle links carry a memo and are grouped by label.
        </p>
        <div className="row align-end">
          <label className="field grow">
            <span>Address or .cook name</span>
            <input
              value={addrInput}
              onChange={(e) => setAddrInput(e.target.value.trim())}
              onKeyDown={(e) => e.key === 'Enter' && isValidRecipient(addrInput) && onLoadInput()}
              placeholder={owner ? owner.toBase58() : 'Paste an address, type alice.cook, or connect a wallet'}
              spellCheck={false}
              className={addrInput && !isValidRecipient(addrInput) ? 'invalid' : ''}
            />
            {resolveMsg && <small className="err">{resolveMsg}</small>}
          </label>
          <button className="btn btn-primary" disabled={!isValidRecipient(addrInput)} onClick={onLoadInput}>
            Load
          </button>
          {!connected && (
            <button className="btn btn-ghost" onClick={() => setVisible(true)}>
              Use my wallet
            </button>
          )}
          {connected && publicKey && !publicKey.equals(owner ?? PublicKey.default) && (
            <button className="btn btn-ghost" onClick={() => setOwner(publicKey)}>
              Use my wallet
            </button>
          )}
        </div>
      </section>

      {owner && (
        <>
          <section className="tiles">
            <div className="tile">
              <span className="tile-label">Payments</span>
              <span className="tile-value">{visible.length}</span>
              <span className="muted small">of {scanned} tx scanned</span>
            </div>
            <div className="tile">
              <span className="tile-label">Total (USD est.)</span>
              <span className="tile-value">{totalUsd > 0 ? formatUsd(totalUsd) : '—'}</span>
              <span className="muted small">at current Cookiescan prices</span>
            </div>
            {totals.slice(0, 2).map((t) => (
              <div className="tile" key={t.mint}>
                <span className="tile-label">{t.symbol}</span>
                <span className="tile-value">{formatAmount(t.raw, t.decimals, 4)}</span>
                <span className="muted small">{t.count} payment{t.count === 1 ? '' : 's'}</span>
              </div>
            ))}
          </section>

          <div className="grid-2">
            <section className="card">
              <h2>By day (last 14 active days)</h2>
              {daily.days.length === 0 ? (
                <p className="muted">Nothing yet.</p>
              ) : (
                <div className="bars">
                  {daily.days.map(([d, n]) => (
                    <div className="bar-col" key={d} title={`${d}: ${n}`}>
                      <div className="bar" style={{ height: `${(n / daily.max) * 100}%` }} />
                      <span className="bar-lbl">{d.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="card">
              <h2>By label</h2>
              {byLabel.length === 0 ? (
                <p className="muted">Nothing yet.</p>
              ) : (
                <ul className="labels">
                  {byLabel.map(([l, n]) => (
                    <li key={l}>
                      <span>{l}</span>
                      <span className="pill">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="card">
            <div className="row space">
              <h2>
                Incoming to{' '}
                {ownerName && <strong>{ownerName} </strong>}
                <a href={explorerAddress(owner.toBase58())} target="_blank" rel="noreferrer" className="mono">
                  {shortAddr(owner.toBase58(), 6)}
                </a>
              </h2>
              <label className="check">
                <input type="checkbox" checked={onlySprinkle} onChange={(e) => setOnlySprinkle(e.target.checked)} /> Sprinkle payments only
              </label>
            </div>
            {error && <p className="err">{error}</p>}
            {visible.length === 0 && !loading && <p className="muted">No incoming payments found in the scanned range.</p>}
            {visible.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>From</th>
                      <th>Amount</th>
                      <th>Label</th>
                      <th>Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p) => {
                      const t = tokens.find((x) => x.mint === p.mint)
                      return (
                        <tr key={p.signature}>
                          <td className="nowrap">{p.blockTime ? new Date(p.blockTime * 1000).toLocaleString() : '—'}</td>
                          <td className="mono">
                            <a href={explorerAddress(p.from)} target="_blank" rel="noreferrer">
                              {shortAddr(p.from)}
                            </a>
                          </td>
                          <td className="nowrap">
                            {formatAmount(p.rawAmount, p.decimals)} {t?.symbol ?? (p.mint === COOK_MINT ? 'COOK' : shortAddr(p.mint))}
                          </td>
                          <td>{p.sprinkle ? p.label || <span className="muted">tip</span> : <span className="muted">{p.memo || '—'}</span>}</td>
                          <td className="mono">
                            <a href={explorerTx(p.signature)} target="_blank" rel="noreferrer">
                              {shortAddr(p.signature, 5)}
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="actions">
              <button className="btn btn-ghost" disabled={loading || exhausted || !cursor} onClick={() => load(owner, cursor, false)}>
                {loading ? 'Loading…' : exhausted ? 'End of history' : 'Load older'}
              </button>
              <button className="btn btn-ghost" disabled={loading} onClick={() => load(owner, null, true)}>
                Refresh
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
