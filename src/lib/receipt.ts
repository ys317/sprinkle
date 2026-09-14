// Reads one transaction from Cookie Chain and turns it into a human receipt.
// No indexer: getParsedTransaction + pre/post balances, the same way the dashboard works.
import { type Connection, type ParsedInstruction, type ParsedTransactionWithMeta } from '@solana/web3.js'
import { COOK_MINT, MEMO_PREFIX } from './chain'

export interface ReceiptTransfer {
  from: string | null
  to: string
  mint: string
  rawAmount: bigint
  decimals: number
}

export interface Receipt {
  signature: string
  slot: number
  blockTime: number | null
  ok: boolean
  err: string | null
  feePayer: string
  feeLamports: number
  transfers: ReceiptTransfer[]
  memo: string
  label: string | null
  sprinkle: boolean
}

export async function fetchReceipt(connection: Connection, signature: string): Promise<Receipt | null> {
  const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
  if (!tx) return null
  return parseReceipt(signature, tx)
}

export function parseReceipt(signature: string, tx: ParsedTransactionWithMeta): Receipt {
  const keys = tx.transaction.message.accountKeys
  const feePayer = keys[0]?.pubkey.toBase58() ?? ''
  const ixs = tx.transaction.message.instructions
  const inner = tx.meta?.innerInstructions?.flatMap((x) => x.instructions) ?? []
  const all = [...ixs, ...inner]

  let memo = ''
  const transfers: ReceiptTransfer[] = []

  for (const ix of all) {
    if (!('parsed' in ix)) continue
    const pi = ix as ParsedInstruction
    if (pi.program === 'spl-memo' && typeof pi.parsed === 'string') memo = pi.parsed
    if (pi.program === 'system' && pi.parsed?.type === 'transfer') {
      const lamports = BigInt(pi.parsed.info.lamports)
      // Bridges and programs emit 0-lamport "touch" transfers; they are not payments.
      if (lamports === 0n) continue
      transfers.push({
        from: pi.parsed.info.source,
        to: pi.parsed.info.destination,
        mint: COOK_MINT,
        rawAmount: lamports,
        decimals: 9,
      })
    }
  }

  // Token movements from balance deltas (covers SPL and Token-2022, direct or via CPI).
  const pre = tx.meta?.preTokenBalances ?? []
  const post = tx.meta?.postTokenBalances ?? []
  const deltas: { owner: string; mint: string; delta: bigint; decimals: number }[] = []
  for (const pb of post) {
    const before = pre.find((x) => x.accountIndex === pb.accountIndex)
    const delta = BigInt(pb.uiTokenAmount.amount) - BigInt(before?.uiTokenAmount.amount ?? '0')
    if (delta !== 0n && pb.owner) deltas.push({ owner: pb.owner, mint: pb.mint, delta, decimals: pb.uiTokenAmount.decimals })
  }
  for (const pb of pre) {
    if (!post.some((x) => x.accountIndex === pb.accountIndex) && pb.owner) {
      deltas.push({ owner: pb.owner, mint: pb.mint, delta: -BigInt(pb.uiTokenAmount.amount), decimals: pb.uiTokenAmount.decimals })
    }
  }
  for (const d of deltas) {
    if (d.delta <= 0n) continue
    const src = deltas.find((x) => x.mint === d.mint && x.delta < 0n && x.owner !== d.owner)
    transfers.push({ from: src?.owner ?? null, to: d.owner, mint: d.mint, rawAmount: d.delta, decimals: d.decimals })
  }

  const sprinkle = memo.startsWith(MEMO_PREFIX)
  let label: string | null = null
  if (sprinkle) {
    const rest = memo.slice(MEMO_PREFIX.length)
    const cut = rest.lastIndexOf(':')
    label = cut > 0 ? rest.slice(0, cut) : rest
  }

  return {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    ok: !tx.meta?.err,
    err: tx.meta?.err ? JSON.stringify(tx.meta.err) : null,
    feePayer,
    feeLamports: tx.meta?.fee ?? 0,
    transfers,
    memo,
    label,
    sprinkle,
  }
}

/** The transfer a receipt is "about": the largest one leaving the fee payer, else the largest overall. */
export function mainTransfer(r: Receipt): ReceiptTransfer | null {
  const byAmount = (a: ReceiptTransfer, b: ReceiptTransfer) => (a.rawAmount > b.rawAmount ? -1 : a.rawAmount < b.rawAmount ? 1 : 0)
  const mine = r.transfers.filter((t) => t.from === r.feePayer).sort(byAmount)
  return mine[0] ?? [...r.transfers].sort(byAmount)[0] ?? null
}
