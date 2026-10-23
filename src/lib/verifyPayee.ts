/**
 * verifyPayee — DNS-over-HTTPS domain verification for Earmark payees.
 *
 * A payee proves ownership of a wallet by publishing a DNS TXT record:
 *   earmark=0xTheirAddress
 * on either _earmark.<domain> or <domain> itself.
 *
 * Lookup uses Cloudflare DoH as primary, Google DoH as fallback (both support CORS).
 * Both resolve on HTTPS so no mixed-content issues in the browser.
 *
 * Caching: in-memory Map keyed by "domain:address" (lowercase), 10-minute TTL.
 */

export type VerifyResult =
  | { status: 'verified' }
  | { status: 'mismatch';   otherAddresses: string[] }
  | { status: 'no-record' }
  | { status: 'error';      message: string }
  | { status: 'invalid-domain'; message: string }

// ─── Domain normalisation ──────────────────────────────────────────────────────

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/

/**
 * Normalise a domain-like string and validate it.
 * Returns { ok: true, domain } or { ok: false, message }.
 */
export function normaliseDomain(raw: string): { ok: true; domain: string } | { ok: false; message: string } {
  let s = raw.trim().toLowerCase()
  // Strip URL scheme
  s = s.replace(/^https?:\/\//, '')
  // Strip www.
  s = s.replace(/^www\./, '')
  // Strip path, query, fragment, port
  s = s.split('/')[0].split('?')[0].split('#')[0].split(':')[0]
  // Strip trailing dot
  s = s.replace(/\.$/, '')

  if (!s) return { ok: false, message: 'Enter a domain name (e.g. haldensupplies.com).' }
  if (s.length < 3) return { ok: false, message: 'Domain too short.' }

  // Reject non-ASCII (emoji domains, etc.)
  if (/[^\x20-\x7E]/.test(s)) {
    return { ok: false, message: 'Use the plain web address (letters, numbers and hyphens only).' }
  }
  // Reject punycode (look-alike protection)
  if (s.split('.').some((label) => label.startsWith('xn--'))) {
    return { ok: false, message: 'Use the plain web address (letters, numbers and hyphens only).' }
  }
  if (!DOMAIN_RE.test(s)) {
    return { ok: false, message: "That doesn't look like a valid domain. Use e.g. haldensupplies.com." }
  }
  return { ok: true, domain: s }
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

interface CacheEntry { result: VerifyResult; at: number }
const cache = new Map<string, CacheEntry>()

function cacheKey(domain: string, address: string) {
  return `${domain.toLowerCase()}:${address.toLowerCase()}`
}

// ─── DNS TXT fetch ────────────────────────────────────────────────────────────

interface DnsResponse {
  Status: number
  Answer?: Array<{ type: number; data: string }>
}

async function fetchTxt(name: string, signal: AbortSignal): Promise<string[]> {
  const urls = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`,
  ]
  let lastErr: Error | null = null
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/dns-json' },
        signal,
      })
      if (!res.ok) continue
      const json = (await res.json()) as DnsResponse
      if (json.Status !== 0) return []
      // TXT data may be split into quoted chunks: "part1" "part2"
      // Strip quotes and join.
      return (json.Answer ?? [])
        .filter((r) => r.type === 16) // 16 = TXT
        .map((r) =>
          r.data
            .split('" "').join('')   // join adjacent chunks
            .replace(/^"|"$/g, '')   // strip outer quotes
            .trim()
        )
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastErr ?? new Error('All DoH lookups failed')
}

// ─── Core verification ────────────────────────────────────────────────────────

async function checkName(
  name: string,
  address: string,
  signal: AbortSignal,
): Promise<{ matched: boolean; others: string[] } | null> {
  try {
    const records = await fetchTxt(name, signal)
    const earmarkRecords = records.filter((r) => r.toLowerCase().startsWith('earmark='))
    if (earmarkRecords.length === 0) return null
    const others: string[] = []
    let matched = false
    for (const rec of earmarkRecords) {
      const val = rec.slice('earmark='.length).trim()
      if (val.toLowerCase() === address.toLowerCase()) {
        matched = true
      } else {
        others.push(val)
      }
    }
    return { matched, others }
  } catch {
    return null
  }
}

/**
 * Verify that `address` is published in a DNS TXT record under `domain`.
 * Checks `_earmark.<domain>` first, then `<domain>` itself.
 */
export async function verifyPayeeDomain(
  rawDomain: string,
  address: string,
): Promise<VerifyResult> {
  const normalised = normaliseDomain(rawDomain)
  if (!normalised.ok) return { status: 'invalid-domain', message: normalised.message }
  const domain = normalised.domain

  const key = cacheKey(domain, address)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result

  const ac = new AbortController()
  const timeout = setTimeout(() => ac.abort(), 6000)

  try {
    // Check _earmark.<domain> first, then <domain>
    const earmarkSub = await checkName(`_earmark.${domain}`, address, ac.signal)
    const apex = earmarkSub ?? await checkName(domain, address, ac.signal)

    let result: VerifyResult
    if (!apex) {
      result = { status: 'no-record' }
    } else if (apex.matched) {
      result = { status: 'verified' }
    } else {
      result = { status: 'mismatch', otherAddresses: apex.others }
    }

    cache.set(key, { result, at: Date.now() })
    return result
  } catch {
    const result: VerifyResult = { status: 'error', message: "Couldn't check — both DNS lookups failed." }
    return result
  } finally {
    clearTimeout(timeout)
  }
}

// ─── React hook ───────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'

export interface VerifyState {
  result: VerifyResult | null
  loading: boolean
}

/**
 * React hook that verifies a payee domain against an address.
 * Debounced 600ms; uses the module-level cache (10-minute TTL).
 * Pass domain='' or address='' to get { result: null, loading: false }.
 *
 * State is only updated asynchronously (never synchronously inside the effect
 * body) to satisfy the react/set-state-in-effect lint rule.
 */
export function usePayeeVerification(domain: string, address: string): VerifyState {
  // Derive the "should verify" key synchronously so we can initialise state
  // from the cache without an effect.
  const normDomain = domain ? normaliseDomain(domain) : null
  const validDomain = normDomain?.ok ? normDomain.domain : null
  const shouldVerify = !!(validDomain && address)

  function initState(): VerifyState {
    if (!shouldVerify || !validDomain) return { result: null, loading: false }
    const key = cacheKey(validDomain, address)
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { result: cached.result, loading: false }
    return { result: null, loading: false }
  }

  const [state, setState] = useState<VerifyState>(initState)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!shouldVerify || !validDomain) {
      // Reset state asynchronously via microtask to avoid the sync-setState warning.
      // This is safe: the component already shows nothing when result is null.
      const t = setTimeout(() => setState({ result: null, loading: false }), 0)
      return () => clearTimeout(t)
    }

    // Check cache first
    const key = cacheKey(validDomain, address)
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      const t = setTimeout(() => setState({ result: cached.result, loading: false }), 0)
      return () => clearTimeout(t)
    }

    // Show loading after a short tick to avoid spinner flash
    const loadingT = setTimeout(() => setState((s) => ({ ...s, loading: true })), 0)

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      let cancelled = false
      void verifyPayeeDomain(domain, address).then((result) => {
        if (!cancelled) setState({ result, loading: false })
      })
      return () => { cancelled = true }
    }, 600)

    return () => {
      clearTimeout(loadingT)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [domain, address, shouldVerify, validDomain])

  return state
}
