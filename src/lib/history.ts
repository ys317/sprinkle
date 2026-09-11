// Reads a wallet's incoming Sprinkle payments straight from chain history.
// Uses getSignaturesForAddress + getParsedTransactions; no indexer, no backend.
import { PublicKey, type Connection, type ParsedInstruction, type ParsedTransactionWithMeta } from '@solana/web3.js'
import { COOK_MINT, MEMO_PREFIX } from './chain'

export interface IncomingPayment {
  signature: string
  slot: number
  blockTime: number | null
  from: string
  mint: string
  rawAmount: bigint
  decimals: number
  label: string
  memo: string
  sprinkle: boolean
}

export interface HistoryPage {
  payments: IncomingPayment[]
  scanned: number
  newestSignature: string | null
  oldestSignature: string | null
  exhausted: boolean
}

export async function fetchIncoming(
  connection: Connection,
  owner: PublicKey,
  opts: { before?: string; limit?: number } = {},
): Promise<HistoryPage> {
  const limit = opts.limit ?? 50
  const sigs = await connection.getSignaturesForAddress(owner, { before: opts.before, limit }, 'confirmed')
  if (sigs.length === 0) return { payments: [], scanned: 0, newestSignature: null, oldestSignature: null, exhausted: true }

  const ok = sigs.filter((s) => !s.err)
  const txs = await connection.getParsedTransactions(
    ok.map((s) => s.signature),
    { maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
  )

  const ownerStr = owner.toBase58()
  const payments: IncomingPayment[] = []
  txs.forEach((tx, i) => {
    if (!tx) return
    const p = extractIncoming(tx, ownerStr)
    if (p) payments.push({ ...p, signature: ok[i].signature, slot: ok[i].slot, blockTime: ok[i].blockTime ?? null })
  })

  return {
    payments,
    scanned: sigs.length,
    newestSignature: sigs[0].signature,
    oldestSignature: sigs[sigs.length - 1].signature,
    exhausted: sigs.length < limit,
  }
}

type Partial = Omit<IncomingPayment, 'signature' | 'slot' | 'blockTime'>

function extractIncoming(tx: ParsedTransactionWithMeta, owner: string): Partial | null {
  const ixs = tx.transaction.message.instructions
  const inner = tx.meta?.innerInstructions?.flatMap((x) => x.instructions) ?? []
  const all = [...ixs, ...inner]

  let memo = ''
  for (const ix of all) {
    if ('program' in ix && ix.program === 'spl-memo' && typeof ix.parsed === 'string') memo = ix.parsed
  }

  const feePayer = tx.transaction.message.accountKeys[0]?.pubkey.toBase58() ?? ''
  if (feePayer === owner) return null // outgoing

  // Native COOK transfer
  for (const ix of all) {
    if (!('parsed' in ix)) continue
    const pi = ix as ParsedInstruction
    if (pi.program === 'system' && pi.parsed?.type === 'transfer' && pi.parsed.info?.destination === owner) {
      return finish({
        from: pi.parsed.info.source,
        mint: COOK_MINT,
        rawAmount: BigInt(pi.parsed.info.lamports),
        decimals: 9,
        memo,
      })
    }
  }

  // SPL / Token-2022 transfer into an account owned by `owner`
  const post = tx.meta?.postTokenBalances ?? []
  const pre = tx.meta?.preTokenBalances ?? []
  for (const pb of post) {
    if (pb.owner !== owner) continue
    const before = pre.find((x) => x.accountIndex === pb.accountIndex)
    const delta = BigInt(pb.uiTokenAmount.amount) - BigInt(before?.uiTokenAmount.amount ?? '0')
    if (delta > 0n) {
      return finish({ from: feePayer, mint: pb.mint, rawAmount: delta, decimals: pb.uiTokenAmount.decimals, memo })
    }
  }
  return null
}

function finish(p: Omit<Partial, 'label' | 'sprinkle'>): Partial {
  const sprinkle = p.memo.startsWith(MEMO_PREFIX)
  let label = ''
  if (sprinkle) {
    const rest = p.memo.slice(MEMO_PREFIX.length)
    label = rest.slice(0, rest.lastIndexOf(':') > 0 ? rest.lastIndexOf(':') : rest.length)
  }
  return { ...p, label, sprinkle }
}
