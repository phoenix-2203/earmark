/**
 * server/earmark-api.mjs
 *
 * Earmark payee-wallet API.
 * Zero npm dependencies — uses node:http, node:crypto, and global fetch (Node 18+).
 *
 * Required env vars (server will exit if missing):
 *   PRIVY_APP_ID          — your Privy application ID
 *   PRIVY_APP_SECRET      — your Privy application secret
 *   PRIVY_VERIFICATION_KEY — ES256 public key PEM; literal \n is accepted
 *
 * Optional env vars:
 *   PORT                  — listen port (default 8787)
 *   PRIVY_API_BASE        — override Privy auth base (default https://auth.privy.io)
 *   PRIVY_API_V1_BASE     — override Privy v1 base  (default https://api.privy.io)
 */

import { createServer } from 'node:http'
import { createPublicKey, verify as cryptoVerify } from 'node:crypto'

// ─── Environment ─────────────────────────────────────────────────────────────

const PRIVY_APP_ID           = process.env.PRIVY_APP_ID            ?? ''
const PRIVY_APP_SECRET       = process.env.PRIVY_APP_SECRET        ?? ''
const PRIVY_VERIFICATION_KEY = (process.env.PRIVY_VERIFICATION_KEY ?? '').replace(/\\n/g, '\n')
const PORT                   = Number(process.env.PORT ?? 8787)
const PRIVY_API_BASE         = (process.env.PRIVY_API_BASE  ?? 'https://auth.privy.io').replace(/\/$/, '')
const PRIVY_API_V1_BASE      = (process.env.PRIVY_API_V1_BASE ?? 'https://api.privy.io').replace(/\/$/, '')

// ─── Personal email domains ───────────────────────────────────────────────────

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

/** @param {string} email */
function emailKind(email) {
  const domain = email.slice(email.indexOf('@') + 1)
  return PERSONAL_DOMAINS.has(domain) ? 'personal' : 'business'
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

/** @type {Map<string, { hourTs: number; hourCount: number; dayTs: number; dayCreates: number }>} */
const rateLimitMap = new Map()

const HOUR_MS = 60 * 60 * 1000
const DAY_MS  = 24 * HOUR_MS

/**
 * Check rate limits for a token subject.
 * Returns null if within limits; or an object {status, error} if limited.
 * @param {string} sub
 * @param {boolean} wouldCreate — pass true BEFORE making a create call
 */
function checkRateLimit(sub, wouldCreate) {
  const now  = Date.now()
  let entry = rateLimitMap.get(sub)
  if (!entry) {
    entry = { hourTs: now, hourCount: 0, dayTs: now, dayCreates: 0 }
    rateLimitMap.set(sub, entry)
  }

  // Roll windows
  if (now - entry.hourTs >= HOUR_MS) { entry.hourTs = now; entry.hourCount = 0 }
  if (now - entry.dayTs  >= DAY_MS)  { entry.dayTs  = now; entry.dayCreates = 0 }

  if (entry.hourCount >= 60) {
    return { status: 429, error: 'Too many lookups. Try again in an hour.' }
  }
  if (wouldCreate && entry.dayCreates >= 20) {
    return { status: 429, error: 'You have set up many new payees today. Try again tomorrow.' }
  }
  return null
}

/** Increment counters after a successful (non-blocked) request. */
function recordRequest(sub, created) {
  const entry = rateLimitMap.get(sub)
  if (!entry) return
  entry.hourCount++
  if (created) entry.dayCreates++
}

// Hourly cleanup — unref so it doesn't keep the process alive in tests
const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - DAY_MS
  for (const [sub, entry] of rateLimitMap) {
    if (entry.hourTs < cutoff && entry.dayTs < cutoff) rateLimitMap.delete(sub)
  }
}, HOUR_MS)
cleanupTimer.unref()

// ─── JWT verification ─────────────────────────────────────────────────────────

/**
 * Decode and verify a Privy ES256 JWT.
 * Returns the payload on success, throws an Error on any failure.
 * @param {string} token
 * @returns {{ sub: string }}
 */
function verifyPrivyJwt(token) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('malformed jwt')

  const headerJson  = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
  const payloadJson = JSON.parse(Buffer.from(parts[1], 'base64url').toString())

  // Algorithm must be exactly ES256 — reject "none" and everything else
  if (headerJson.alg !== 'ES256') throw new Error('unexpected alg')

  // Verify signature: ES256 = ECDSA P-256 with SHA-256, signature in IEEE P1363 format
  const signingInput  = Buffer.from(`${parts[0]}.${parts[1]}`)
  const signatureBytes = Buffer.from(parts[2], 'base64url')
  const pubKey = createPublicKey(PRIVY_VERIFICATION_KEY)

  const valid = cryptoVerify(
    'sha256',
    signingInput,
    { key: pubKey, dsaEncoding: 'ieee-p1363' },
    signatureBytes,
  )
  if (!valid) throw new Error('invalid signature')

  // Claims
  const now = Math.floor(Date.now() / 1000)
  if (payloadJson.iss !== 'privy.io')                      throw new Error('bad iss')
  if (payloadJson.exp == null || payloadJson.exp <= now)    throw new Error('expired')
  if (!payloadJson.sub)                                     throw new Error('missing sub')

  // aud may be a string or an array
  const aud = payloadJson.aud
  const audMatch = Array.isArray(aud)
    ? aud.includes(PRIVY_APP_ID)
    : aud === PRIVY_APP_ID
  if (!audMatch) throw new Error('bad aud')

  return payloadJson
}

// ─── Privy API calls ──────────────────────────────────────────────────────────

const PRIVY_TIMEOUT_MS = 10_000

/**
 * Make an authenticated Privy API call.
 * Throws on network error or timeout; returns { status, body } on HTTP response.
 * @param {string} url
 * @param {{ method?: string; body?: unknown }} opts
 */
async function privyFetch(url, { method = 'GET', body } = {}) {
  const creds = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PRIVY_TIMEOUT_MS)

  let response
  try {
    response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'Authorization': `Basic ${creds}`,
        'privy-app-id': PRIVY_APP_ID,
        'content-type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } finally {
    clearTimeout(timer)
  }

  // Parse body regardless of status code
  let parsed
  try { parsed = await response.json() } catch { parsed = null }
  return { status: response.status, body: parsed }
}

/**
 * Find an embedded Privy Ethereum wallet in a user's linked_accounts array.
 * @param {unknown[]} accounts
 * @returns {string | null} — wallet address or null
 */
function findEmbeddedWallet(accounts) {
  if (!Array.isArray(accounts)) return null
  const w = accounts.find(
    (a) =>
      a != null &&
      typeof a === 'object' &&
      a.type === 'wallet' &&
      a.chain_type === 'ethereum' &&
      (a.wallet_index === 0 || a.wallet_index == null) &&
      (a.wallet_client === 'privy' ||
       a.wallet_client_type === 'privy' ||
       a.connector_type === 'embedded'),
  )
  return w ? (/** @type {any} */ (w).address ?? null) : null
}

/**
 * Look up or create a Privy embedded wallet for an email.
 * Returns { address: string, created: boolean }.
 * Throws { proxyError: true } on Privy upstream errors.
 * @param {string} email
 */
async function getOrCreateWallet(email) {
  // Step a: look up by email
  const lookup = await privyFetch(`${PRIVY_API_BASE}/api/v1/users/email/address`, {
    method: 'POST',
    body: { address: email },
  })

  if (lookup.status === 200) {
    // User exists — find their embedded wallet
    const userId  = lookup.body?.id
    const address = findEmbeddedWallet(lookup.body?.linked_accounts)

    if (address) {
      return { address, created: false }
    }

    // User exists but has no embedded wallet — create one
    if (!userId) throw { proxyError: true }
    const create = await privyFetch(`${PRIVY_API_V1_BASE}/v1/users/${userId}/wallets`, {
      method: 'POST',
      body: { wallets: [{ chain_type: 'ethereum' }] },
    })
    const newAddress = findEmbeddedWallet(create.body?.wallets ?? create.body?.linked_accounts)
    if (create.status === 200 && newAddress) {
      return { address: newAddress, created: true }
    }
    throw { proxyError: true }
  }

  if (lookup.status === 404) {
    // User does not exist — create user + wallet in one call
    const create = await privyFetch(`${PRIVY_API_BASE}/api/v1/users`, {
      method: 'POST',
      body: {
        linked_accounts: [{ type: 'email', address: email }],
        wallets: [{ chain_type: 'ethereum', wallet_index: 0 }],
      },
    })
    const newAddress = findEmbeddedWallet(create.body?.linked_accounts)
    if ((create.status === 200 || create.status === 201) && newAddress) {
      return { address: newAddress, created: true }
    }
    throw { proxyError: true }
  }

  // Any other Privy status → upstream error
  throw { proxyError: true }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

const SAFE_HEADERS = {
  'content-type':           'application/json',
  'cache-control':          'no-store',
  'x-content-type-options': 'nosniff',
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, SAFE_HEADERS)
  res.end(payload)
}

/**
 * Read up to maxBytes from the request body.
 * Resolves with the raw string; rejects with { tooBig: true } if exceeded.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} maxBytes
 */
function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let data = ''
    let size = 0
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk, 'utf8')
      if (size > maxBytes) { reject({ tooBig: true }); req.destroy(); return }
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// ─── Email validation ─────────────────────────────────────────────────────────

const EMAIL_RE = /^[a-z0-9._%+\-]{1,64}@(?=.{3,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/

// ─── Request handler ──────────────────────────────────────────────────────────

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function handleRequest(req, res) {
  const url = req.url?.split('?')[0] ?? ''

  // ── GET /api/health ──────────────────────────────────────────────────────────
  if (url === '/api/health') {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' })
    return json(res, 200, { ok: true })
  }

  // ── POST /api/payee-wallet ───────────────────────────────────────────────────
  if (url === '/api/payee-wallet') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })

    // 1. Auth — verify JWT
    const authHeader = req.headers['authorization'] ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return json(res, 401, { error: 'Sign in again to look up payees.' })

    let payload
    try {
      payload = verifyPrivyJwt(token)
    } catch {
      return json(res, 401, { error: 'Sign in again to look up payees.' })
    }
    const sub = payload.sub

    // 2. Read body (max 2 KB)
    let raw
    try {
      raw = await readBody(req, 2048)
    } catch (e) {
      if (e && typeof e === 'object' && 'tooBig' in e) {
        return json(res, 400, { error: 'Request body too large.' })
      }
      return json(res, 400, { error: 'Could not read request body.' })
    }

    let body
    try {
      body = JSON.parse(raw)
    } catch {
      return json(res, 400, { error: 'Request body must be JSON.' })
    }

    // 3. Validate email
    const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!EMAIL_RE.test(rawEmail)) {
      return json(res, 400, { error: 'Enter a valid email address.' })
    }

    // 4a. Hourly rate limit (before doing anything)
    const hourCheck = checkRateLimit(sub, false)
    if (hourCheck) return json(res, hourCheck.status, { error: hourCheck.error })

    // We don't yet know if this will create, so we speculatively check the
    // day create limit here. If it turns out to be a lookup (no create) this
    // check is conservative but harmless — we'd only block when they've
    // already hit 20 creates today, and a lookup still returns successfully
    // because checkRateLimit returns null for lookups when only the day-create
    // limit is hit. See the function: we only reject creates, not lookups.
    // (The actual create-limit check happens below once we know wouldCreate.)

    // 5. Privy call
    let result
    try {
      // Check day create limit BEFORE we attempt to create a wallet.
      // We peek at the rate-limit state without mutating it.
      const preCreateCheck = checkRateLimit(sub, true)
      // We'll pass wouldCreate=true only when we know a create will happen.
      // Since we don't know yet, we tentatively check; if the day limit is hit
      // we defer the real rejection to after the lookup so existing wallets
      // are still returned.
      result = await getOrCreateWallet(rawEmail)

      if (result.created) {
        // NOW enforce day create limit
        if (preCreateCheck) return json(res, preCreateCheck.status, { error: preCreateCheck.error })
      }
    } catch (e) {
      if (e && typeof e === 'object' && 'proxyError' in e) {
        return json(res, 502, { error: 'Couldn\'t reach the wallet service. Try again shortly.' })
      }
      // Unexpected error — don't leak details
      return json(res, 502, { error: 'Couldn\'t reach the wallet service. Try again shortly.' })
    }

    // 6. Record usage AFTER success
    recordRequest(sub, result.created)

    return json(res, 200, {
      email:     rawEmail,
      address:   result.address,
      created:   result.created,
      emailKind: emailKind(rawEmail),
    })
  }

  // ── Unknown path ─────────────────────────────────────────────────────────────
  return json(res, 404, { error: 'Not found.' })
}

// ─── Server startup ───────────────────────────────────────────────────────────

// Validate required env vars and exit immediately if any are missing.
// Only do this when run as the main script (not imported for testing).
function checkEnvOrExit() {
  const missing = []
  if (!PRIVY_APP_ID)           missing.push('PRIVY_APP_ID')
  if (!PRIVY_APP_SECRET)       missing.push('PRIVY_APP_SECRET')
  if (!PRIVY_VERIFICATION_KEY) missing.push('PRIVY_VERIFICATION_KEY')
  if (missing.length > 0) {
    process.stderr.write(`earmark-api: missing required env vars: ${missing.join(', ')}\n`)
    process.exit(1)
  }
}

/** Export the handler so tests can call it directly without starting the server. */
export { handleRequest, verifyPrivyJwt, getOrCreateWallet, checkRateLimit, recordRequest, emailKind, rateLimitMap }

// Start the server only when run directly (node earmark-api.mjs), not when imported.
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  checkEnvOrExit()

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      process.stderr.write(`earmark-api: unhandled error: ${String(err)}\n`)
      if (!res.headersSent) json(res, 500, { error: 'Internal server error.' })
    })
  })

  server.listen(PORT, '127.0.0.1', () => {
    process.stdout.write(`earmark-api listening on 127.0.0.1:${PORT}\n`)
  })
}
