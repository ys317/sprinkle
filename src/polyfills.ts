// Must be the very first import: @solana/spl-token touches Buffer at module-evaluation time.
import { Buffer } from 'buffer'
;(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer
