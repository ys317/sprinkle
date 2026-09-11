// Quick live check of .cook resolution against the chain. Run: node nametest.mjs
import { Connection, PublicKey } from '@solana/web3.js'
const c = new Connection('https://rpc.cookiescan.io', 'confirmed')
const PROG = new PublicKey('H43Qtq4AMQ86y7yc3YtCKZJ2QMhhnCcHyZKeFeoQn7PA')
const disc = [35, 146, 98, 112, 13, 230, 231, 153]
for (const label of ['meme', 'alice', 'cookie', 'bot', 'simplex']) {
  const pda = PublicKey.findProgramAddressSync([Buffer.from('domain'), Buffer.from(label)], PROG)[0]
  const info = await c.getAccountInfo(pda)
  if (!info) { console.log(label + '.cook', '-> unregistered'); continue }
  const d = info.data
  const ok = disc.every((b, i) => d[i] === b)
  const len = d.readUInt32LE(8)
  const owner = new PublicKey(d.subarray(12 + len, 12 + len + 32)).toBase58()
  console.log(label + '.cook', ok ? 'OK' : 'BAD-DISC', 'len', d.length, 'owner', owner)
  const ppda = PublicKey.findProgramAddressSync([Buffer.from('primary'), new PublicKey(owner).toBuffer()], PROG)[0]
  const pinfo = await c.getAccountInfo(ppda)
  if (pinfo) { const l = pinfo.data.readUInt32LE(40); console.log('   primary of owner:', pinfo.data.subarray(44, 44 + l).toString()) }
}
// enumerate a few registered names
const accs = await c.getProgramAccounts(PROG, { filters: [{ memcmp: { offset: 0, bytes: (await import('bs58')).default.encode(Buffer.from(disc)) } }] })
console.log('registered names:', accs.length)
for (const a of accs.slice(0, 8)) { const d = a.account.data; const len = d.readUInt32LE(8); console.log('  ', d.subarray(12, 12 + len).toString() + '.cook') }
