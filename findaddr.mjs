// Find an address with many incoming transfers (for a dashboard demo screenshot).
import { Connection, PublicKey } from '@solana/web3.js'
const c = new Connection('https://rpc.cookiescan.io', 'confirmed')
const cands = [
  'CL2JoQ5jdTpRNKshWhaTihuooT4qrKdLUiPsqKj3yAKz', // hyperlane collateral pool
  '4GGk4vTDd1FCA4NHd62xcwcab86KAm6dFtG7zrGKSGUx', // cookie.cook / simplex.cook owner
  'AuCPPPDywCr9tq3LrYC4cGM5mpfYpZy1ZKYhshZvPtFj', // meme.cook owner
  '7rQTSWbk1nMRPve2q3wcS1rT6g2shkXkNDGnZX53zEzR', // bot.cook owner
  'B8AB9R9J98yggrwdnZhoHuGJBc8RzTpHsqDnRkTnMuV', // cookie-mcp treasury (referral fees)
]
for (const a of cands) {
  const owner = new PublicKey(a)
  try {
    const sigs = await c.getSignaturesForAddress(owner, { limit: 40 }, 'confirmed')
    const txs = await c.getParsedTransactions(sigs.filter(s=>!s.err).map((s) => s.signature), { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
    let native = 0, token = 0
    for (const tx of txs) {
      if (!tx) continue
      const fp = tx.transaction.message.accountKeys[0].pubkey.toBase58()
      if (fp === a) continue
      const all = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions ?? []).flatMap((x) => x.instructions)]
      if (all.some((ix) => ix.program === 'system' && ix.parsed?.type === 'transfer' && ix.parsed.info?.destination === a)) native++
      for (const pb of tx.meta?.postTokenBalances ?? []) {
        if (pb.owner !== a) continue
        const pre = (tx.meta?.preTokenBalances ?? []).find((x) => x.accountIndex === pb.accountIndex)
        if (BigInt(pb.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? '0') > 0n) { token++; break }
      }
    }
    console.log(a.slice(0, 8), 'sigs', sigs.length, 'incoming native', native, 'token', token)
  } catch (e) { console.log(a.slice(0, 8), 'ERR', e.message.slice(0, 80)) }
}
