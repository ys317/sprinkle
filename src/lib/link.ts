// A payment request is fully encoded in the URL, so links work with no backend and never expire.
import { COOK_MINT, isValidPubkey } from './chain'

export interface PaymentRequest {
  to: string // recipient pubkey
  mint: string // token mint; COOK_MINT for native
  amount?: string // human-readable decimal, optional (tip jar mode when absent)
  label?: string // short label shown to payer and written into the memo
  message?: string // longer description shown to payer only
}

export function encodeRequest(r: PaymentRequest): string {
  const p = new URLSearchParams()
  p.set('to', r.to)
  if (r.mint !== COOK_MINT) p.set('mint', r.mint)
  if (r.amount) p.set('amt', r.amount)
  if (r.label) p.set('label', r.label.slice(0, 40))
  if (r.message) p.set('msg', r.message.slice(0, 200))
  return `/pay?${p.toString()}`
}

export function decodeRequest(search: string): PaymentRequest | { error: string } {
  const p = new URLSearchParams(search)
  const to = p.get('to')?.trim() ?? ''
  if (!to) return { error: 'This link has no recipient.' }
  if (!isValidPubkey(to)) return { error: 'The recipient address in this link is not valid.' }
  const mint = p.get('mint')?.trim() || COOK_MINT
  if (!isValidPubkey(mint)) return { error: 'The token mint in this link is not valid.' }
  const amount = p.get('amt')?.trim() || undefined
  if (amount && !/^\d*(\.\d+)?$/.test(amount)) return { error: 'The amount in this link is not valid.' }
  return {
    to,
    mint,
    amount,
    label: p.get('label')?.trim() || undefined,
    message: p.get('msg')?.trim() || undefined,
  }
}

export function absoluteUrl(path: string): string {
  return `${window.location.origin}${path}`
}
