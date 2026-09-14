// Vercel serverless proxy for the Candy Shop swap aggregator (swap.cookiescan.io/api).
// The aggregator does not send CORS headers, so the browser cannot call it directly; this function
// forwards a small allow-list of read/build endpoints. It never sees a private key: the browser signs
// the returned transaction with the user's wallet and broadcasts it to the Cookie Chain RPC itself.
const UPSTREAM = 'https://swap.cookiescan.io/api'
const ALLOW = [
  /^quote\/multi-route$/,
  /^swap-tx\/multi-route$/,
  /^submit-tx$/,
  /^confirm-tx\/[1-9A-HJ-NP-Za-km-z]{60,100}$/,
  /^tokens$/,
]

interface Req {
  method?: string
  query: Record<string, string | string[] | undefined>
  body?: unknown
}
interface Res {
  status(code: number): Res
  setHeader(name: string, value: string): Res
  send(body: string): void
  json(body: unknown): void
}

export default async function handler(req: Req, res: Res) {
  const raw = req.query.path
  const path = Array.isArray(raw) ? raw.join('/') : String(raw ?? '')
  if (!ALLOW.some((re) => re.test(path))) {
    res.status(404).json({ error: 'not proxied' })
    return
  }
  const url = new URL(`${UPSTREAM}/${path}`)
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== 'path' && typeof v === 'string') url.searchParams.set(k, v)
  }
  const init: RequestInit = {
    method: req.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': 'sprinkle/1.0 (+https://sprinkle-ten.vercel.app)',
    },
  }
  if (init.method === 'POST') {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
  }
  try {
    const upstream = await fetch(url, init)
    const text = await upstream.text()
    res
      .status(upstream.status)
      .setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
      .setHeader('cache-control', 'no-store')
      .send(text)
  } catch (e) {
    res.status(502).json({ error: `aggregator unreachable: ${e instanceof Error ? e.message : String(e)}` })
  }
}
