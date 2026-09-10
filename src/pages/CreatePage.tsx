import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import QRCode from 'qrcode'
import { COOK_MINT, isValidPubkey } from '../lib/chain'
import { absoluteUrl, encodeRequest } from '../lib/link'
import { fetchTokenRegistry, formatUsd, parseAmount, type TokenInfo } from '../lib/tokens'

export function CreatePage() {
  const { publicKey } = useWallet()
  const [to, setTo] = useState('')
  const [touchedTo, setTouchedTo] = useState(false)
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [mint, setMint] = useState(COOK_MINT)
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

  const token = tokens.find((t) => t.mint === mint) ?? tokens[0]
  const toValid = isValidPubkey(to)
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
          <span>Recipient address</span>
          <input
            value={to}
            onChange={(e) => {
              setTouchedTo(true)
              setTo(e.target.value.trim())
            }}
            placeholder={publicKey ? publicKey.toBase58() : 'Connect a wallet or paste an address'}
            spellCheck={false}
            className={to && !toValid ? 'invalid' : ''}
          />
          {to && !toValid && <small className="err">Not a valid Cookie Chain address.</small>}
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
              <dd className="mono">{to}</dd>
              {label && (
                <>
                  <dt>Memo</dt>
                  <dd>crumbtrail:v1:{label.replace(/[^ -~]/g, '')}</dd>
                </>
              )}
            </dl>
          </>
        )}
      </section>
    </div>
  )
}
