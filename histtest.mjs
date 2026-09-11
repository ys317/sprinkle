import { Connection, PublicKey } from '@solana/web3.js'
const c = new Connection('https://rpc.cookiescan.io', 'confirmed')
const owner = new PublicKey('46TVwUmdKkFv82sSj42cy67QAA16hiaTiNxn38KhuwQD')
const t0 = Date.now()
const sigs = await c.getSignaturesForAddress(owner, { limit: 50 }, 'confirmed')
console.log('sigs', sigs.length, Date.now() - t0, 'ms')
const t1 = Date.now()
const txs = await c.getParsedTransactions(sigs.map((s) => s.signature), { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
console.log('parsed', txs.filter(Boolean).length, Date.now() - t1, 'ms')
let inc = 0
for (const tx of txs) {
  if (!tx) continue
  const fp = tx.transaction.message.accountKeys[0].pubkey.toBase58()
  if (fp === owner.toBase58()) continue
  for (const pb of tx.meta?.postTokenBalances ?? []) {
    if (pb.owner !== owner.toBase58()) continue
    const pre = (tx.meta?.preTokenBalances ?? []).find((x) => x.accountIndex === pb.accountIndex)
    const d = BigInt(pb.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? '0')
    if (d > 0n) { inc++; if (inc <= 3) console.log(' incoming', pb.mint.slice(0, 6), d.toString(), 'from', fp.slice(0, 6)) }
  }
}
console.log('incoming count', inc)
