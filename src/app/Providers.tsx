import { useMemo, type ReactNode } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { NightlyWalletAdapter } from '@solana/wallet-adapter-wallets'
import { RPC_URL, WS_URL } from '../lib/chain'
import '@solana/wallet-adapter-react-ui/styles.css'

export function Providers({ children }: { children: ReactNode }) {
  // Nightly is the wallet Cookie Chain recommends; any other Wallet Standard wallet the user has
  // installed is auto-detected by the provider as well.
  const wallets = useMemo(() => [new NightlyWalletAdapter()], [])
  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: 'confirmed', wsEndpoint: WS_URL }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
