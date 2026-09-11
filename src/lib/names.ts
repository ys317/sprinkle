// `.cook` names — Cookie Chain's on-chain name service (CookOven, program H43Qtq4A…).
// Forward lookup is a single PDA read: ["domain", label] → DomainAccount { name, owner, … }.
// Reverse lookup is ["primary", owner] → PrimaryDomain { owner, name }.
// Layouts and discriminators mirror cookiechain/cookie-mcp (src/core/domains/program.ts).
import { PublicKey, type Connection } from '@solana/web3.js'

export const DOMAINS_PROGRAM_ID = new PublicKey('H43Qtq4AMQ86y7yc3YtCKZJ2QMhhnCcHyZKeFeoQn7PA')
const DOMAIN_MARKET_PROGRAM_ID = new PublicKey('Ey35mr69UfiQqZSwD2qYAZoMNfnuVJGCjwNSB64ppHm7')
export const COOK_TLD = '.cook'

const DISC_DOMAIN = Uint8Array.from([35, 146, 98, 112, 13, 230, 231, 153])
const DISC_PRIMARY = Uint8Array.from([231, 255, 61, 63, 142, 184, 254, 42])

// Names listed for sale are owned by the marketplace escrow PDA, not by a wallet. Paying that
// address would send funds into a program account, so resolution refuses it.
const ESCROW_AUTHORITY = PublicKey.findProgramAddressSync([Buffer.from('escrow_authority')], DOMAIN_MARKET_PROGRAM_ID)[0].toBase58()

export function normalizeName(input: string): string {
  const s = input.trim().toLowerCase()
  return s.endsWith(COOK_TLD) ? s.slice(0, -COOK_TLD.length) : s
}

export function isValidLabel(label: string): boolean {
  return label.length > 0 && label.length <= 32 && /^[a-z0-9-]+$/.test(label) && !label.startsWith('-') && !label.endsWith('-')
}

/** `alice.cook` → true; a base58 pubkey → false. */
export function looksLikeName(input: string): boolean {
  const s = input.trim()
  if (s.toLowerCase().endsWith(COOK_TLD)) return true
  return s.length > 0 && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)
}

export function domainPda(label: string): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('domain'), Buffer.from(label, 'utf8')], DOMAINS_PROGRAM_ID)[0]
}
export function primaryPda(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('primary'), owner.toBuffer()], DOMAINS_PROGRAM_ID)[0]
}

function hasDisc(data: Uint8Array, disc: Uint8Array): boolean {
  if (data.length < 8) return false
  for (let i = 0; i < 8; i++) if (data[i] !== disc[i]) return false
  return true
}

export interface ResolvedName {
  label: string
  name: string
  owner: PublicKey
}

export type ResolveError = 'invalid' | 'unregistered' | 'for-sale'

/** Forward lookup. Returns the owner wallet, or a reason it cannot be paid. */
export async function resolveName(connection: Connection, input: string): Promise<ResolvedName | { error: ResolveError }> {
  const label = normalizeName(input)
  if (!isValidLabel(label)) return { error: 'invalid' }
  const info = await connection.getAccountInfo(domainPda(label), 'confirmed')
  if (!info) return { error: 'unregistered' }
  const data = info.data as Uint8Array
  if (!hasDisc(data, DISC_DOMAIN) || data.length < 12) return { error: 'unregistered' }
  const nameLen = new DataView(data.buffer, data.byteOffset).getUint32(8, true)
  const end = 12 + nameLen
  if (nameLen === 0 || end + 32 > data.length) return { error: 'unregistered' }
  const owner = new PublicKey(data.subarray(end, end + 32))
  if (owner.toBase58() === ESCROW_AUTHORITY) return { error: 'for-sale' }
  return { label, name: `${label}${COOK_TLD}`, owner }
}

/** Reverse lookup: the wallet's primary `.cook` name, or null. */
export async function primaryName(connection: Connection, owner: PublicKey): Promise<string | null> {
  const info = await connection.getAccountInfo(primaryPda(owner), 'confirmed')
  if (!info) return null
  const data = info.data as Uint8Array
  if (!hasDisc(data, DISC_PRIMARY) || data.length < 44) return null
  const len = new DataView(data.buffer, data.byteOffset).getUint32(40, true)
  if (len === 0 || 44 + len > data.length) return null
  return `${new TextDecoder().decode(data.subarray(44, 44 + len))}${COOK_TLD}`
}

/** Address or `.cook` name → PublicKey. */
export async function resolveRecipient(connection: Connection, input: string): Promise<{ pubkey: PublicKey; name: string | null } | { error: ResolveError }> {
  const s = input.trim()
  if (!looksLikeName(s)) {
    try {
      return { pubkey: new PublicKey(s), name: null }
    } catch {
      return { error: 'invalid' }
    }
  }
  const r = await resolveName(connection, s)
  if ('error' in r) return r
  return { pubkey: r.owner, name: r.name }
}

export const RESOLVE_ERROR_TEXT: Record<ResolveError, string> = {
  invalid: 'Not a valid address or .cook name.',
  unregistered: 'That .cook name is not registered.',
  'for-sale': 'That .cook name is listed for sale, so it has no wallet to pay right now.',
}
