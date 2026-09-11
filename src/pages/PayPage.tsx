import { useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useLocation } from 'react-router-dom'
import { BRIDGE_URL, COOK_MINT, SWAP_URL, explorerAddress, explorerTx, shortAddr } from '../lib/chain'
import { decodeRequest } from '../lib/link'
import { RESOLVE_ERROR_TEXT, resolveRecipient, type ResolveError } from '../lib/names'
import { explainWalletError, sendPayment, type PayStage } from '../lib/pay'
import { formatAmount, formatUsd, lookupToken, parseAmount, type TokenInfo } from '../lib/tokens'

const STAGE_TEXT: Record<PayStage, string> = {
  idle: '',
  building: 'Building transaction…',
  signing: 'Approve in your wallet…',
  sending: 'Broadcasting to Cookie Chain…',
  confirming: 'Waiting for confirmation…',
  confirmed: 'Confirmed',
  failed: 'Failed',
}

export function PayPage() {
  const { search } = useLocation()
  const req = useMemo(() => decodeRequest(search), [search])
  const { connection } = useConnection()
  const { publicKey, connected, signTransaction } = useWallet()
  const { setVisible } = useWalletModal()

  const [token, setToken] = useState<TokenInfo | null | undefined>(undefined)
  const [recipient, setRecipient] = useState<{ pubkey: PublicKey; name: string | null } | null>(null)
  const [resolveErr, setResolveErr] = useState<ResolveError | null>(null)
  const [amount, setAmount] = useState('')
  const [balance, setBalance] = useState<bigint | null>(null)
  const [stage, setStage] = useState<PayStage>('idle')
  const [sig, setSig] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [seconds, setSeconds] = useState<number | null>(null)

  const mint = 'error' in req ? COOK_MINT : req.mint
  const fixedAmount = 'error' in req ? undefined : req.amount
  const toInput = 'error' in req ? '' : req.to

  useEffect(() => {
    if ('error' in req) return
    setAmount(fixedAmount ?? '')
    lookupToken(mint).then((t) => setToken(t))
  }, [req, mint, fixedAmount])

  // Resolve the recipient (address or .cook name) on-chain at payment time.
  useEffect(() => {
    setRecipient(null)
    setResolveErr(null)
    if (!toInput) return
    let alive = true
    resolveRecipient(connection, toInput).then((r) => {
      if (!alive) return
      if ('error' in r) setResolveErr(r.error)
      else setRecipient(r)
    })
    return () => {
      alive = false
    }
  }, [connection, toInput])

  // Payer balance for the requested token.
  useEffect(() => {
    if (!publicKey || !token) {
      setBalance(null)
      return
    }
    let alive = true
    const load = async () => {
      try {
        if (token.mint === COOK_MINT) {
          const v = await connection.getBalance(publicKey, 'confirmed')
          if (alive) setBalance(BigInt(v))
        } else {
          const mintPk = new PublicKey(token.mint)
          const info = await connection.getAccountInfo(mintPk, 'confirmed')
          const program = info?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
          const ata = getAssociatedTokenAddressSync(mintPk, publicKey, false, program)
          const bal = await connection.getTokenAccountBalance(ata, 'confirmed').catch(() => null)
          if (alive) setBalance(bal ? BigInt(bal.value.amount) : 0n)
        }
      } catch {
        if (alive) setBalance(null)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [connection, publicKey, token, stage])

  useEffect(() => {
    if (stage !== 'sending' && stage !== 'confirming') {
      setSeconds(null)
      return
    }
    const start = Date.now()
    const id = setInterval(() => setSeconds(Math.round((Date.now() - start) / 100) / 10), 100)
    return () => clearInterval(id)
  }, [stage])

  if ('error' in req) {
    return (
      <div className="card narrow">
        <h1>Invalid link</h1>
        <p className="err">{req.error}</p>
      </div>
    )
  }
  if (token === undefined) return <div className="card narrow muted">Loading token…</div>
  if (token === null) {
    return (
      <div className="card narrow">
        <h1>Unknown token</h1>
        <p className="err">
          Mint <code>{mint}</code> is not in the Cookie Chain token registry.
        </p>
      </div>
    )
  }
  if (resolveErr) {
    return (
      <div className="card narrow">
        <h1>Cannot resolve recipient</h1>
        <p className="err">
          <code>{req.to}</code>: {RESOLVE_ERROR_TEXT[resolveErr]}
        </p>
      </div>
    )
  }
  if (!recipient) return <div className="card narrow muted">Resolving {req.to} on Cookie Chain…</div>

  const raw = parseAmount(amount, token.decimals)
  const usd = raw && token.priceUsd ? (Number(raw) / 10 ** token.decimals) * token.priceUsd : null
  const insufficient = raw !== null && balance !== null && raw > balance
  const busy = stage === 'building' || stage === 'signing' || stage === 'sending' || stage === 'confirming'
  const canPay = connected && !!publicKey && !!signTransaction && raw !== null && !insufficient && !busy

  const onPay = async () => {
    if (!publicKey || !signTransaction || raw === null) return
    setError('')
    setSig('')
    try {
      const res = await sendPayment({
        connection,
        payer: publicKey,
        recipient: recipient.pubkey,
        mint: token.mint,
        decimals: token.decimals,
        rawAmount: raw,
        label: req.label,
        signTransaction,
        onStage: (s, d) => {
          setStage(s)
          if (d && (s === 'confirming' || s === 'confirmed')) setSig(d)
        },
      })
      setSig(res.signature)
      setStage('confirmed')
    } catch (e) {
      setStage('failed')
      setError(explainWalletError(e))
    }
  }

  const selfPay = publicKey?.equals(recipient.pubkey) ?? false
  const recipientAddr = recipient.pubkey.toBase58()

  return (
    <div className="card narrow paycard">
      <div className="pay-head">
        {token.logo ? <img src={token.logo} alt="" className="token-logo" /> : <span className="token-logo fallback">{token.symbol.slice(0, 2)}</span>}
        <div>
          <h1>{req.label ? req.label : 'Payment request'}</h1>
          <div className="muted">
            to{' '}
            {recipient.name && <strong>{recipient.name} </strong>}
            <a href={explorerAddress(recipientAddr)} target="_blank" rel="noreferrer" className="mono">
              {shortAddr(recipientAddr, 6)}
            </a>
          </div>
        </div>
      </div>
      {req.message && <p className="message">{req.message}</p>}

      <label className="field big">
        <span>Amount ({token.symbol})</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.trim())}
          readOnly={!!fixedAmount}
          inputMode="decimal"
          placeholder="0.0"
          className={amount && raw === null ? 'invalid' : ''}
        />
        <small className="muted">
          {usd !== null ? `≈ ${formatUsd(usd)}` : token.priceUsd ? '' : 'No USD price for this token'}
          {balance !== null && (
            <>
              {' · '}balance {formatAmount(balance, token.decimals, 4)} {token.symbol}
            </>
          )}
        </small>
        {insufficient && <small className="err">Insufficient {token.symbol} balance.</small>}
      </label>

      {!connected && (
        <button className="btn btn-primary btn-lg" onClick={() => setVisible(true)}>
          Connect wallet to pay
        </button>
      )}
      {connected && (
        <button className="btn btn-primary btn-lg" onClick={onPay} disabled={!canPay}>
          {busy ? STAGE_TEXT[stage] : `Pay ${raw ? formatAmount(raw, token.decimals) : ''} ${token.symbol}`}
        </button>
      )}
      {selfPay && <p className="muted small">You are paying yourself. That works, but it is a bit pointless.</p>}

      {busy && (
        <div className="progress">
          {(['building', 'signing', 'sending', 'confirming'] as const).map((s, i) => {
            const cur = ['building', 'signing', 'sending', 'confirming'].indexOf(stage)
            return <Step key={s} done={i < cur} active={i === cur} label={['Build', 'Sign', 'Send', 'Confirm'][i]} />
          })}
          {seconds !== null && <span className="muted">{seconds.toFixed(1)}s</span>}
        </div>
      )}

      {stage === 'confirmed' && sig && (
        <div className="result ok">
          <strong>Paid.</strong> Confirmed on Cookie Chain{seconds !== null ? ` in ${seconds.toFixed(1)}s` : ''}.
          <br />
          <a href={explorerTx(sig)} target="_blank" rel="noreferrer" className="mono">
            {shortAddr(sig, 10)}
          </a>
          <button className="btn btn-ghost btn-sm" onClick={() => { setStage('idle'); setSig(''); if (!fixedAmount) setAmount('') }}>
            Pay again
          </button>
        </div>
      )}
      {stage === 'failed' && (
        <div className="result bad">
          <strong>Not sent.</strong> {error}
          {sig && (
            <>
              {' '}
              <a href={explorerTx(sig)} target="_blank" rel="noreferrer" className="mono">
                view tx
              </a>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setStage('idle')}>
            Try again
          </button>
        </div>
      )}

      {connected && balance === 0n && (
        <p className="muted small">
          No {token.symbol} in this wallet.{' '}
          {token.mint === COOK_MINT ? (
            <>
              Bridge COOK from Solana at{' '}
              <a href={BRIDGE_URL} target="_blank" rel="noreferrer">
                hyperlane.cookiescan.io
              </a>
              .
            </>
          ) : (
            <>
              Swap for it at{' '}
              <a href={SWAP_URL} target="_blank" rel="noreferrer">
                swap.cookiescan.io
              </a>
              .
            </>
          )}
        </p>
      )}
    </div>
  )
}

function Step({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return <span className={`step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>{label}</span>
}
