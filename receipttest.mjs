// Live check of the receipt parser against real Cookie Chain transactions.
import { Connection, PublicKey } from '@solana/web3.js'
const c = new Connection('https://rpc.cookiescan.io', 'confirmed')
const pool = new PublicKey('CL2JoQ5jdTpRNKshWhaTihuooT4qrKdLUiPsqKj3yAKz')
const sigs = await c.getSignaturesForAddress(pool, { limit: 3 }, 'confirmed')
for (const s of sigs) {
  const tx = await c.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
  const keys = tx.transaction.message.accountKeys
  const all = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions ?? []).flatMap((x) => x.instructions)]
  const sys = all.filter((ix) => ix.program === 'system' && ix.parsed?.type === 'transfer').map((ix) => `${ix.parsed.info.source.slice(0, 6)}→${ix.parsed.info.destination.slice(0, 6)} ${ix.parsed.info.lamports / 1e9} COOK`)
  const memo = all.find((ix) => ix.program === 'spl-memo')?.parsed
  console.log(s.signature.slice(0, 12), 'feePayer', keys[0].pubkey.toBase58().slice(0, 6), 'fee', tx.meta.fee, 'ok', !tx.meta.err, '| sys transfers:', sys, '| memo:', memo ?? '-', '| tokenBal deltas:', (tx.meta.postTokenBalances ?? []).length)
}
