/**
 * src/lib/emailPayee.ts
 *
 * Email-based payee lookup helpers.
 *
 * - classifyEmail: 'personal' | 'business'
 * - lookupPayeeWallet: POST /api/payee-wallet with a Privy access token
 * - getEmailPayeeAddress / storeEmailPayee: localStorage cache
 * - isEmail: quick check before showing the email UI path
 */

// ── Personal email providers ────────────────────────────────────────────────
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'ymail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'proton.me', 'protonmail.com',
  'gmx.com', 'gmx.net', 'mail.com',
  'yandex.com',
  'zoho.com', 'zohomail.com',
  'hey.com',
  'fastmail.com',
  'tutanota.com',
])

export function classifyEmail(email: string): 'personal' | 'business' {
  const lower = email.trim().toLowerCase()
  const at = lower.lastIndexOf('@')
  if (at < 0) return 'business'
  const domain = lower.slice(at + 1)
  return PERSONAL_DOMAINS.has(domain) ? 'personal' : 'business'
}

/** Quick syntactic check — not full RFC validation (server validates properly). */
export function isEmail(value: string): boolean {
  return value.includes('@') && !value.startsWith('0x')
}

// ── API response shape ──────────────────────────────────────────────────────
export interface PayeeWalletResponse {
  email: string
  address: `0x${string}`
  created: boolean
  emailKind: 'personal' | 'business'
}

export interface PayeeWalletError {
  error: string
  statusCode: number
}

export type PayeeWalletResult =
  | { ok: true; data: PayeeWalletResponse }
  | { ok: false; error: string; statusCode: number }

// ── API lookup ──────────────────────────────────────────────────────────────
export async function lookupPayeeWallet(
  email: string,
  getAccessToken: () => Promise<string | null>,
): Promise<PayeeWalletResult> {
  let token: string | null = null
  try {
    token = await getAccessToken()
  } catch {
    return { ok: false, error: 'Sign in again.', statusCode: 401 }
  }

  if (!token) {
    return { ok: false, error: 'Sign in to look up this email.', statusCode: 401 }
  }

  try {
    const res = await fetch('/api/payee-wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })

    let body: unknown
    try { body = await res.json() } catch { body = {} }

    if (res.ok) {
      const d = body as Partial<PayeeWalletResponse>
      if (!d.address || !d.email) {
        return { ok: false, error: 'Unexpected response from server. Try again.', statusCode: 502 }
      }
      return { ok: true, data: d as PayeeWalletResponse }
    }

    const errBody = body as { error?: string }
    const errMsg = errBody.error ?? 'Something went wrong. Try again.'

    if (res.status === 401) return { ok: false, error: 'Sign in again.', statusCode: 401 }
    return { ok: false, error: errMsg, statusCode: res.status }
  } catch {
    return { ok: false, error: 'Couldn\'t reach the server. Check your connection.', statusCode: 0 }
  }
}

// ── localStorage cache keyed by funder+address ──────────────────────────────
const LS_KEY = 'earmark.emailPayees'

interface EmailPayeeEntry {
  email: string
  at: number
}

function loadCache(): Record<string, EmailPayeeEntry> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, EmailPayeeEntry>) : {}
  } catch { return {} }
}

function saveCache(cache: Record<string, EmailPayeeEntry>): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cache)) } catch { /* quota */ }
}

export function getEmailPayeeAddress(funder: string, address: string): string | null {
  const cache = loadCache()
  const key = `${funder.toLowerCase()}:${address.toLowerCase()}`
  return cache[key]?.email ?? null
}

export function storeEmailPayee(funder: string, address: string, email: string): void {
  const cache = loadCache()
  const key = `${funder.toLowerCase()}:${address.toLowerCase()}`
  cache[key] = { email: email.trim().toLowerCase(), at: Date.now() }
  saveCache(cache)
}
