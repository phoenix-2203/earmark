/**
 * confirmPayee — "Ask the payee to confirm" wallet-signature flow.
 *
 * The funder creates a confirmation request and shares a link with the payee.
 * The payee connects their wallet and signs a free message (no gas, no money moves).
 * The funder receives the reply link, verifies the signature on-chain (supports ERC-1271
 * smart-contract wallets via publicClient.verifyMessage), and records the result locally.
 *
 * SECURITY MODEL:
 * - The code is only accepted if it was generated in this browser (localStorage check).
 *   A recipient cannot generate their own confirmation and send it to a different funder.
 * - Expiry is checked on both sides (7 days).
 * - chainId and funder address are checked when verifying the reply.
 *
 * STORAGE KEYS (localStorage):
 *   earmark.confirmRequests  — Map<code, ConfirmRequest> (this browser created these)
 *   earmark.confirmedPayees  — Map<funder+payee, ConfirmedPayee>
 */

import { EARMARK_CHAIN_ID } from '@/earmarkConfig'

// ─── Types ────────────────────────────────────────────────────────────────────

/** A confirmation request the funder generated and saved locally. */
export interface ConfirmRequest {
  v: 1
  chainId: number
  funder: `0x${string}`
  payee: `0x${string}`
  name: string
  purpose: string
  /** 8 chars A-Z2-9, shown as XXXX-XXXX */
  code: string
  /** Unix seconds */
  exp: number
}

/** A successfully verified confirmation stored in this browser. */
export interface ConfirmedPayee {
  payee: `0x${string}`
  name: string
  code: string
  /** Unix seconds */
  at: number
}

// ─── Code generation ──────────────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 chars, no I/O/1/0

/** Generate a random 8-character code from CODE_CHARS. */
export function generateCode(): string {
  const arr = new Uint8Array(8)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

/** Display a code as XXXX-XXXX. */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

// ─── Request encode/decode ────────────────────────────────────────────────────

/**
 * Base64url-encode (no padding) a UTF-8 JSON string.
 * Safe for URL query parameters and clipboard sharing.
 * Uses TextEncoder so non-ASCII characters (e.g. · in pot titles) survive.
 */
export function encodeRequest(req: ConfirmRequest): string {
  const json = JSON.stringify(req)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  // Convert each byte individually (safe for all Unicode)
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Decode a base64url string back into a ConfirmRequest.
 * Returns null if the string is malformed or not a v:1 request.
 * Uses TextDecoder to correctly handle non-ASCII characters.
 */
export function decodeRequest(encoded: string): ConfirmRequest | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const json = new TextDecoder().decode(bytes)
    const obj = JSON.parse(json) as unknown
    if (
      typeof obj === 'object' && obj !== null &&
      (obj as Record<string, unknown>).v === 1
    ) {
      return obj as ConfirmRequest
    }
    return null
  } catch {
    return null
  }
}

// ─── Confirmation message ────────────────────────────────────────────────────

/**
 * Build the exact EIP-191 personal_sign message from a ConfirmRequest.
 * Both sides (payee and funder) must produce the same string from the same request.
 */
export function buildConfirmMessage(req: ConfirmRequest): string {
  return [
    'Earmark payee confirmation',
    `I confirm this wallet belongs to: ${req.name}`,
    `Wallet: ${req.payee}`,
    `For: ${req.purpose}`,
    `Requested by: ${req.funder}`,
    `Code: ${req.code}`,
    `Network: ${req.chainId}`,
  ].join('\n')
}

// ─── Expiry ───────────────────────────────────────────────────────────────────

export const CONFIRM_TTL_SECS = 7 * 24 * 60 * 60 // 7 days

export function isRequestExpired(req: ConfirmRequest): boolean {
  return Date.now() / 1000 > req.exp
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const REQUESTS_KEY = 'earmark.confirmRequests'
const CONFIRMED_KEY = 'earmark.confirmedPayees'

function loadRequests(): Record<string, ConfirmRequest> {
  try {
    const raw = localStorage.getItem(REQUESTS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, ConfirmRequest>
  } catch {
    return {}
  }
}

function saveRequests(map: Record<string, ConfirmRequest>): void {
  try {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(map))
  } catch { /* quota exceeded — silently ignore */ }
}

function loadConfirmed(): Record<string, ConfirmedPayee> {
  try {
    const raw = localStorage.getItem(CONFIRMED_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, ConfirmedPayee>
  } catch {
    return {}
  }
}

function saveConfirmed(map: Record<string, ConfirmedPayee>): void {
  try {
    localStorage.setItem(CONFIRMED_KEY, JSON.stringify(map))
  } catch { /* quota exceeded */ }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create and persist a new confirmation request.
 * Returns { req, link, encoded } so the caller can show the share dialog.
 */
export function createConfirmRequest(opts: {
  funder: `0x${string}`
  payee: `0x${string}`
  name: string
  purpose: string
}): { req: ConfirmRequest; encoded: string; link: string } {
  const req: ConfirmRequest = {
    v: 1,
    chainId: EARMARK_CHAIN_ID,
    funder: opts.funder,
    payee: opts.payee,
    name: opts.name,
    purpose: opts.purpose,
    code: generateCode(),
    exp: Math.floor(Date.now() / 1000) + CONFIRM_TTL_SECS,
  }
  const encoded = encodeRequest(req)
  const link = `${window.location.origin}/#/confirm-payee?r=${encoded}`

  const map = loadRequests()
  map[req.code] = req
  saveRequests(map)

  return { req, encoded, link }
}

/** Returns the stored request for a code, or null if not in this browser. */
export function getStoredRequest(code: string): ConfirmRequest | null {
  return loadRequests()[code] ?? null
}

/**
 * Record a successfully verified payee confirmation.
 * Key: funder (lowercase) + payee (lowercase).
 */
export function storeConfirmedPayee(
  funder: `0x${string}`,
  payee: `0x${string}`,
  name: string,
  code: string,
): void {
  const key = `${funder.toLowerCase()}:${payee.toLowerCase()}`
  const map = loadConfirmed()
  map[key] = { payee, name, code, at: Math.floor(Date.now() / 1000) }
  saveConfirmed(map)
}

/**
 * Retrieve the confirmation record for a funder+payee pair, or null.
 * Accepts undefined funder (not connected) — returns null.
 */
export function getConfirmedPayee(
  funder: `0x${string}` | undefined,
  payee: `0x${string}`,
): ConfirmedPayee | null {
  if (!funder) return null
  const key = `${funder.toLowerCase()}:${payee.toLowerCase()}`
  return loadConfirmed()[key] ?? null
}

/**
 * Returns true if there is a pending (not-yet-confirmed) request in this browser
 * for the given funder+payee on the current chain.
 */
export function hasPendingRequest(
  funder: `0x${string}` | undefined,
  payee: `0x${string}`,
): boolean {
  if (!funder) return false
  const map = loadRequests()
  return Object.values(map).some(
    (r) =>
      r.payee.toLowerCase() === payee.toLowerCase() &&
      r.funder.toLowerCase() === funder.toLowerCase() &&
      r.chainId === EARMARK_CHAIN_ID &&
      !isRequestExpired(r),
  )
}

/**
 * Returns all non-expired pending requests made by funder (not yet confirmed).
 */
export function getPendingRequests(funder: `0x${string}`): ConfirmRequest[] {
  const confirmed = loadConfirmed()
  return Object.values(loadRequests()).filter(
    (r) =>
      r.funder.toLowerCase() === funder.toLowerCase() &&
      r.chainId === EARMARK_CHAIN_ID &&
      !isRequestExpired(r) &&
      !confirmed[`${funder.toLowerCase()}:${r.payee.toLowerCase()}`],
  )
}
