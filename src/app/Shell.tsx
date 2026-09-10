import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { Link, NavLink } from 'react-router-dom'
import { COOK_DECIMALS, explorerAddress, shortAddr } from '../lib/chain'
import { formatAmount } from '../lib/tokens'

export function useCookBalance() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [lamports, setLamports] = useState<bigint | null>(null)
  useEffect(() => {
    if (!publicKey) {
      setLamports(null)
      return
    }
    let alive = true
    const load = () => connection.getBalance(publicKey, 'confirmed').then((v) => alive && setLamports(BigInt(v))).catch(() => {})
    load()
    const id = connection.onAccountChange(publicKey, (info) => alive && setLamports(BigInt(info.lamports)), 'confirmed')
    return () => {
      alive = false
      connection.removeAccountChangeListener(id).catch(() => {})
    }
  }, [connection, publicKey])
  return lamports
}

export function WalletButton() {
  const { publicKey, connected, connecting, disconnect, wallet } = useWallet()
  const { setVisible } = useWalletModal()
  const balance = useCookBalance()

  if (!connected || !publicKey) {
    return (
      <button className="btn btn-primary" onClick={() => setVisible(true)} disabled={connecting}>
        {connecting ? 'Connecting…' : 'Connect wallet'}
      </button>
    )
  }
  return (
    <div className="wallet-pill">
      {wallet?.adapter.icon && <img src={wallet.adapter.icon} alt="" width={18} height={18} />}
      <a href={explorerAddress(publicKey.toBase58())} target="_blank" rel="noreferrer" title={publicKey.toBase58()}>
        {shortAddr(publicKey.toBase58())}
      </a>
      {balance !== null && <span className="muted">{formatAmount(balance, COOK_DECIMALS, 3)} COOK</span>}
      <button className="btn btn-ghost btn-sm" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">🍪</span> Crumbtrail
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Create link
          </NavLink>
          <NavLink to="/dashboard">Received</NavLink>
        </nav>
        <WalletButton />
      </header>
      <main className="content">{children}</main>
      <footer className="foot">
        <span>Runs entirely in your browser against the Cookie Chain community RPC. No backend, no accounts.</span>
        <span>
          <a href="https://github.com/ys317/crumbtrail" target="_blank" rel="noreferrer">
            Source
          </a>
          {' · '}
          <a href="https://docs.cookiechain.wtf" target="_blank" rel="noreferrer">
            Cookie Chain docs
          </a>
        </span>
      </footer>
    </div>
  )
}
