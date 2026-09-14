import { useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import QRCode from 'qrcode'
import { COOK_MINT, shortAddr } from '../lib/chain'
import { absoluteUrl, encodeRequest, isValidRecipient } from '../lib/link'
import { RESOLVE_ERROR_TEXT, looksLikeName, resolveRecipient, type ResolveError } from '../lib/names'
import { fetchTokenRegistry, formatUsd, parseAmount, type TokenInfo } from '../lib/tokens'

export function CreatePage() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const initial = new URLSearchParams(window.location.search)
  const [to, setTo] = useState(initial.get('to') ?? '')
  const [touchedTo, setTouchedTo] = useState(!!initial.get('to'))
  const [resolved, setResolved] = useState<{ address: string; name: string } | null>(null)
  const [resolveErr, setResolveErr] = useState<ResolveError | null>(null)
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [mint, setMint] = useState(initial.get('mint') ?? COOK_MINT)
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState('')
  const [qr, setQr] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchTokenRegistry().then(setTokens)
  }, [])
  useEffect(() => {
    if (publicKey && !touchedTo) setTo(publicKey.toBase58())
  }, [publicKey, touchedTo])

  // Resolve .cook names as the user types, so they see where the money will go before sharing.
  useEffect(() => {
    setResolved(null)
    setResolveErr(null)
    if (!looksLikeName(to) || !isValidRecipient(to)) return
    let alive = true
    const id = setTimeout(async () => {
      const r = await resolveRecipient(connection, to)
      if (!alive) return
      if ('error' in r) setResolveErr(r.error)
      else setResolved({ address: r.pubkey.toBase58(), name: r.name ?? to })
    }, 350)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [connection, to])

  const token = tokens.find((t) => t.mint === mint) ?? tokens[0]
  const isName = looksLikeName(to)
  const toValid = isValidRecipient(to) && (!isName || resolved !== null)
  const amountRaw = amount ? parseAmount(amount, token?.decimals ?? 9) : null
  const amountValid = amount === '' || amountRaw !== null
  const ready = toValid && amountValid && !!token

  const path = useMemo(
    () => (ready ? encodeRequest({ to, mint, amount: amount || undefined, label: label || undefined, message: message || undefined }) : ''),
    [ready, to, mint, amount, label, message],
  )
  const url = path ? absoluteUrl(path) : ''

  useEffect(() => {
    if (!url) {
      setQr('')
      return
    }
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#2b1d0e', light: '#fff8ee' } }).then(setQr).catch(() => setQr(''))
  }, [url])

  const usd = amountRaw && token?.priceUsd ? (Number(amountRaw) / 10 ** token.decimals) * token.priceUsd : null

  return (
    <div className="grid-2">
      <section className="card">
        <h1>Create a payment link</h1>
        <p className="lede">
          Get paid on Cookie Chain with a link or QR code. The payer opens it, connects Nightly, and sends
          COOK or any token straight to you. Everything is encoded in the URL, so links never expire.
        </p>

        <label className="field">
          <span>
            Recipient <span className="muted">(address or name.cook)</span>
          </span>
          <input
            value={to}
            onChange={(e) => {
              setTouchedTo(true)
              setTo(e.target.value.trim())
            }}
            placeholder={publicKey ? publicKey.toBase58() : 'Connect a wallet, paste an address, or type alice.cook'}
            spellCheck={false}
            className={to && (!isValidRecipient(to) || resolveErr) ? 'invalid' : ''}
          />
          {to && !isValidRecipient(to) && <small className="err">Not a valid Cookie Chain address or .cook name.</small>}
          {resolveErr && <small className="err">{RESOLVE_ERROR_TEXT[resolveErr]}</small>}
          {isName && isValidRecipient(to) && !resolved && !resolveErr && <small className="muted">Resolving {to} on-chain…</small>}
          {resolved && (
            <small className="muted">
              {resolved.name} → <span className="mono">{shortAddr(resolved.address, 6)}</span>
            </small>
          )}
        </label>

        <div className="row">
          <label className="field">
            <span>Token</span>
            <select value={mint} onChange={(e) => setMint(e.target.value)}>
              {tokens.map((t) => (
                <option key={t.mint} value={t.mint}>
                  {t.symbol} — {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              Amount <span className="muted">(leave empty for a tip jar)</span>
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
              placeholder="any"
              inputMode="decimal"
              className={!amountValid ? 'invalid' : ''}
            />
            {!amountValid && <small className="err">Use up to {token?.decimals} decimals.</small>}
            {usd !== null && <small className="muted">≈ {formatUsd(usd)}</small>}
          </label>
        </div>

        <label className="field">
          <span>
            Label <span className="muted">(written on-chain in the memo, 40 chars)</span>
          </span>
          <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 40))} placeholder="coffee, invoice #12, tip…" />
        </label>
        <label className="field">
          <span>
            Message to payer <span className="muted">(shown on the pay page only)</span>
          </span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 200))} rows={2} placeholder="Thanks for supporting the project!" />
        </label>
      </section>

      <section className="card preview">
        <h2>Your link</h2>
        {!ready && <p className="muted">Fill in a valid recipient to generate the link.</p>}
        {ready && (
          <>
            {qr && <img className="qr" src={qr} alt="QR code for payment link" />}
            <code className="url">{url}</code>
            <div className="actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard.writeText(url).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  })
                }}
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <a className="btn btn-ghost" href={path} target="_blank" rel="noreferrer">
                Open pay page
              </a>
            </div>
            <dl className="summary">
              <dt>Pays</dt>
              <dd>
                {amount || 'any amount'} {token?.symbol}
              </dd>
              <dt>To</dt>
              <dd className="mono">
                {to}
                {resolved && <span className="muted"> → {resolved.address}</span>}
              </dd>
              {label && (
                <>
                  <dt>Memo</dt>
                  <dd>sprinkle:v1:{label.replace(/[^ -~]/g, '')}</dd>
                </>
              )}
            </dl>
          </>
        )}
      </section>
    </div>
  )
}
