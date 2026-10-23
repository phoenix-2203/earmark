/**
 * verifyPayee — DNS-over-HTTPS domain verification for Earmark payees.
 *
 * A payee proves ownership of a wallet by publishing a DNS TXT record:
 *   earmark=0xTheirAddress
 * on either _earmark.<domain> or <domain> itself.
 *
 * Lookup uses Cloudflare DoH as primary, Google DoH as fallback (both support CORS).
 * Caching: in-memory Map keyed by "domain:address" (lowercase), 10-minute TTL.
 * Errors: both providers failing returns { status:'error' } and is NOT cached;
 * only a successful DNS answer with no earmark= record is { status:'no-record' }.
 *
 * Free subdomain services (duckdns.org, github.io, etc.) return 'verified-free-host'
 * — they confirm the wallet but don't prove a real business because anyone can
 * register a subdomain there.
 */

// ─── Free-host list ────────────────────────────────────────────────────────────

export const FREE_HOSTS: string[] = [
  'duckdns.org', 'github.io', 'gitlab.io', 'vercel.app', 'netlify.app',
  'pages.dev', 'workers.dev', 'web.app', 'firebaseapp.com', 'herokuapp.com',
  'onrender.com', 'fly.dev', 'railway.app', 'replit.app', 'repl.co',
  'glitch.me', 'blogspot.com', 'wordpress.com', 'wixsite.com', 'weebly.com',
  'square.site', 'carrd.co', 'notion.site', 'framer.website', 'webflow.io',
  'ngrok-free.app', 'ngrok.io', 'no-ip.org', 'ddns.net', '000webhostapp.com',
  'neocities.org', 'surge.sh', 'azurewebsites.net', 'appspot.com',
  'cloudfront.net', 'amplifyapp.com', 'myshopify.com',
]

/**
 * Returns true when domain equals a free host or is a subdomain of one.
 * "a.duckdns.org" → true, "duckdns.org" → true, "myduckdns.org" → false.
 */
export function isFreeHost(domain: string): false | string {
  const d = domain.toLowerCase()
  for (const h of FREE_HOSTS) {
    if (d === h || d.endsWith('.' + h)) return h
  }
  return false
}

// ─── Result type ──────────────────────────────────────────────────────────────

export type VerifyResult =
  | { status: 'verified' }
  | { status: 'verified-free-host'; host: string; domain: string }
  | { status: 'mismatch';           otherAddresses: string[] }
  | { status: 'no-record' }
  | { status: 'error';              message: string }
  | { status: 'invalid-domain';     message: string }

// ─── Domain normalisation ──────────────────────────────────────────────────────

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/

/**
 * Normalise a domain-like string and validate it.
 * Returns { ok: true, domain } or { ok: false, message }.
 */
export function normaliseDomain(raw: string): { ok: true; domain: string } | { ok: false; message: string } {
  let s = raw.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  s = s.replace(/^www\./, '')
  s = s.split('/')[0].split('?')[0].split('#')[0].split(':')[0]
  s = s.replace(/\.$/, '')

  if (!s) return { ok: false, message: 'Enter a domain name (e.g. haldensupplies.com).' }
  if (s.length < 3) return { ok: false, message: 'Domain too short.' }

  if (/[^\x20-\x7E]/.test(s)) {
    return { ok: false, message: 'Use the plain web address (letters, numbers and hyphens only).' }
  }
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

export function cacheKey(domain: string, address: string) {
  return `${domain.toLowerCase()}:${address.toLowerCase()}`
}

// ─── DNS TXT fetch ────────────────────────────────────────────────────────────

interface DnsResponse {
  Status: number
  Answer?: Array<{ type: number; data: string }>
}

/**
 * Fetch DNS TXT records for `name` from one of two DoH providers.
 * Throws an Error only when both providers fail or time out.
 * Returns [] when the name exists but has no TXT records.
 */
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
      if (!res.ok) {
        lastErr = new Error(`DoH HTTP ${res.status}`)
        continue
      }
      const json = (await res.json()) as DnsResponse
      if (json.Status !== 0) return []
      return (json.Answer ?? [])
        .filter((r) => r.type === 16) // 16 = TXT
        .map((r) =>
          r.data
            .split('" "').join('')
            .replace(/^"|"$/g, '')
            .trim()
        )
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  // Both providers failed
  throw lastErr ?? new Error('All DoH lookups failed')
}

// ─── Core verification ────────────────────────────────────────────────────────

/**
 * Try one DNS name; returns null when no earmark= record exists,
 * { matched, others } when at least one earmark= record is present,
 * and throws when the lookup itself fails (to be caught by the caller).
 */
async function checkName(
  name: string,
  address: string,
  signal: AbortSignal,
): Promise<{ matched: boolean; others: string[] } | null> {
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
}

/**
 * Verify that `address` is published in a DNS TXT record under `domain`.
 * Checks `_earmark.<domain>` first, then `<domain>` itself.
 *
 * Returns 'error' (not cached) when both providers fail or time out.
 * Returns 'no-record' (cached) only when DNS answered but had no earmark= record.
 * Returns 'verified-free-host' (cached) when matched but domain is a free service.
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
    // Both checkName calls may throw; wrap in try/catch after awaiting
    let apex: { matched: boolean; others: string[] } | null = null
    try {
      apex = await checkName(`_earmark.${domain}`, address, ac.signal)
        ?? await checkName(domain, address, ac.signal)
    } catch {
      // Network failure from fetchTxt propagates here; return error, do NOT cache
      return { status: 'error', message: `Couldn't check ${domain} right now.` }
    }

    let result: VerifyResult
    if (!apex) {
      result = { status: 'no-record' }
    } else if (apex.matched) {
      const freeHost = isFreeHost(domain)
      if (freeHost) {
        result = { status: 'verified-free-host', host: freeHost, domain }
      } else {
        result = { status: 'verified' }
      }
    } else {
      result = { status: 'mismatch', otherAddresses: apex.others }
    }

    cache.set(key, { result, at: Date.now() })
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
 */
export function usePayeeVerification(domain: string, address: string): VerifyState {
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
      const t = setTimeout(() => setState({ result: null, loading: false }), 0)
      return () => clearTimeout(t)
    }

    const key = cacheKey(validDomain, address)
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      const t = setTimeout(() => setState({ result: cached.result, loading: false }), 0)
      return () => clearTimeout(t)
    }

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
