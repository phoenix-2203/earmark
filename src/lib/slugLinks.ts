/**
 * slugLinks — unguessable share links derived from transaction hashes.
 *
 * Pot:     #/p/<first 12 hex chars of createPot tx hash>  e.g. #/p/7f3a9c2e41b0
 * Receipt: #/r/<first 12 hex chars of Paid tx hash>       e.g. #/r/a1b2c3d4e5f6
 *
 * Resolution scans PotCreated / Paid logs from EARMARK_FROM_BLOCK in ≤9,000-block
 * chunks, newest-first, matching transactionHash.startsWith('0x'+slug).
 * Results are cached in memory (module-level Map) and sessionStorage.
 */

import { publicClient, EARMARK_ADDRESS, EARMARK_ABI, EARMARK_FROM_BLOCK } from '@/earmarkConfig'

// ── Slug helpers ──────────────────────────────────────────────────────────────

/** Derive a 12-char slug from a tx hash (without 0x prefix). */
export function hashToSlug(hash: string): string {
  return hash.replace(/^0x/i, '').slice(0, 12).toLowerCase()
}

/** Does this full tx hash start with 0x + slug (case-insensitive)? */
export function slugMatches(hash: string, slug: string): boolean {
  const clean = slug.replace(/^0x/i, '').toLowerCase()
  return hash.toLowerCase().startsWith('0x' + clean)
}

/** Is this a syntactically valid slug (12 lowercase hex chars)? */
export function isValidSlug(slug: string): boolean {
  return /^[0-9a-f]{12}$/.test(slug)
}

// ── In-memory + sessionStorage cache ─────────────────────────────────────────

const CACHE_KEY_PREFIX = 'earmark.slug.'

const memCache = new Map<string, { potId: bigint } | { potId: bigint; paymentIndex: number } | 'not-found'>()

function cacheGet(slug: string) {
  if (memCache.has(slug)) return memCache.get(slug)
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + slug)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    if (parsed === 'not-found') { memCache.set(slug, 'not-found'); return 'not-found' }
    if (typeof parsed === 'object' && parsed !== null && 'potId' in parsed) {
      const p = parsed as { potId: string; paymentIndex?: number }
      const entry = 'paymentIndex' in p
        ? { potId: BigInt(p.potId), paymentIndex: p.paymentIndex as number }
        : { potId: BigInt(p.potId) }
      memCache.set(slug, entry)
      return entry
    }
  } catch { /* ignore */ }
  return undefined
}

function cacheSet(slug: string, value: { potId: bigint } | { potId: bigint; paymentIndex: number } | 'not-found') {
  memCache.set(slug, value)
  try {
    if (value === 'not-found') {
      sessionStorage.setItem(CACHE_KEY_PREFIX + slug, JSON.stringify('not-found'))
    } else if ('paymentIndex' in value) {
      sessionStorage.setItem(CACHE_KEY_PREFIX + slug, JSON.stringify({ potId: value.potId.toString(), paymentIndex: value.paymentIndex }))
    } else {
      sessionStorage.setItem(CACHE_KEY_PREFIX + slug, JSON.stringify({ potId: value.potId.toString() }))
    }
  } catch { /* ignore */ }
}

// ── Scan helpers ──────────────────────────────────────────────────────────────

const CHUNK = 9_000n

/**
 * Scan PotCreated logs newest-first for a tx hash matching the slug.
 * Returns potId or null.
 */
export async function resolveSlugToPotId(slug: string): Promise<bigint | null> {
  if (!isValidSlug(slug)) return null

  const cached = cacheGet(slug)
  if (cached === 'not-found') return null
  if (cached && !('paymentIndex' in cached)) return cached.potId

  if (!EARMARK_ADDRESS || EARMARK_ADDRESS.length <= 2) return null

  try {
    const head = await publicClient.getBlockNumber()
    const from = EARMARK_FROM_BLOCK > 0n ? EARMARK_FROM_BLOCK : 0n
    let hi = head

    while (hi >= from) {
      const lo = hi >= CHUNK ? hi - CHUNK + 1n : from
      const actualLo = lo < from ? from : lo

      const logs = await publicClient.getContractEvents({
        address: EARMARK_ADDRESS,
        abi: EARMARK_ABI,
        eventName: 'PotCreated',
        fromBlock: actualLo,
        toBlock: hi,
      })

      for (const log of logs) {
        if (log.transactionHash && slugMatches(log.transactionHash, slug)) {
          const potId = (log.args as { potId?: bigint }).potId
          if (potId !== undefined) {
            cacheSet(slug, { potId })
            return potId
          }
        }
      }

      if (hi < CHUNK || lo <= from) break
      hi = lo - 1n
    }
  } catch { /* network error — don't cache */ return null }

  cacheSet(slug, 'not-found')
  return null
}

/**
 * Scan Paid logs newest-first for a tx hash matching the slug.
 * Returns { potId, paymentIndex } or null.
 */
export async function resolveSlugToReceipt(slug: string): Promise<{ potId: bigint; paymentIndex: number } | null> {
  if (!isValidSlug(slug)) return null

  const cached = cacheGet(slug)
  if (cached === 'not-found') return null
  if (cached && 'paymentIndex' in cached) return cached as { potId: bigint; paymentIndex: number }

  if (!EARMARK_ADDRESS || EARMARK_ADDRESS.length <= 2) return null

  try {
    const head = await publicClient.getBlockNumber()
    const from = EARMARK_FROM_BLOCK > 0n ? EARMARK_FROM_BLOCK : 0n
    let hi = head

    while (hi >= from) {
      const lo = hi >= CHUNK ? hi - CHUNK + 1n : from
      const actualLo = lo < from ? from : lo

      const logs = await publicClient.getContractEvents({
        address: EARMARK_ADDRESS,
        abi: EARMARK_ABI,
        eventName: 'Paid',
        fromBlock: actualLo,
        toBlock: hi,
      })

      for (const log of logs) {
        if (log.transactionHash && slugMatches(log.transactionHash, slug)) {
          const args = log.args as { potId?: bigint; paymentIndex?: bigint }
          if (args.potId !== undefined && args.paymentIndex !== undefined) {
            const result = { potId: args.potId, paymentIndex: Number(args.paymentIndex) }
            cacheSet(slug, result)
            return result
          }
        }
      }

      if (hi < CHUNK || lo <= from) break
      hi = lo - 1n
    }
  } catch { return null }

  cacheSet(slug, 'not-found')
  return null
}
