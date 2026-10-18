import { USDC_DECIMALS_LOCAL } from '@/earmarkConfig'
import { getAddress, isAddress } from 'viem'

/** Format a USDC bigint amount to a human-readable string with 2 decimal places */
export function formatUsdc(raw: bigint): string {
  const divisor = 10n ** BigInt(USDC_DECIMALS_LOCAL)
  const whole = raw / divisor
  const frac = raw % divisor
  const fracStr = frac.toString().padStart(USDC_DECIMALS_LOCAL, '0').slice(0, 2)
  return `${whole.toLocaleString()}.${fracStr}`
}

/** Parse a string USDC amount to bigint (6 decimals). Returns 0n on bad input. */
export function parseUsdc(value: string): bigint {
  if (!value || isNaN(parseFloat(value))) return 0n
  const [whole, frac = ''] = value.split('.')
  const fracPadded = frac.slice(0, USDC_DECIMALS_LOCAL).padEnd(USDC_DECIMALS_LOCAL, '0')
  return BigInt(whole || '0') * 10n ** BigInt(USDC_DECIMALS_LOCAL) + BigInt(fracPadded)
}

/** Shorten an address: 0x1234…abcd */
export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`
}

/** Format a unix timestamp as a human-readable date */
export function formatDate(ts: bigint | number): string {
  return new Date(Number(ts) * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Format a unix timestamp as date + time in user's local timezone */
export function formatDateTime(ts: bigint | number): string {
  return new Date(Number(ts) * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Days remaining until a unix timestamp */
export function daysUntil(ts: bigint | number): number {
  const ms = Number(ts) * 1000 - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

/** Has the expiry passed? */
export function isExpired(ts: bigint | number): boolean {
  return Number(ts) * 1000 < Date.now()
}

/**
 * Convert a local-date string ("YYYY-MM-DD") to a Unix timestamp at 23:59:59
 * in the user's local timezone.  This is what we send as expiry so the pot
 * doesn't close mid-day from the user's perspective.
 */
export function localDateToExpiry(dateStr: string): bigint {
  if (!dateStr) return 0n
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day, 23, 59, 59)
  return BigInt(Math.floor(d.getTime() / 1000))
}

/**
 * Format an expiry bigint as "Ends 20 Oct 2026, 23:59 (your time)"
 * given that we always store 23:59:59 local time.
 */
export function formatExpiry(ts: bigint | number): string {
  return new Date(Number(ts) * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' (your time)'
}

/**
 * Validate and checksum an Ethereum address string.
 * Trims whitespace.  Returns the checksummed address or null on failure.
 */
export function parseChecksumAddress(raw: string): `0x${string}` | null {
  const trimmed = raw.trim()
  if (!isAddress(trimmed)) return null
  try {
    return getAddress(trimmed)
  } catch {
    return null
  }
}

/**
 * Returns true if the string looks like a USDC amount with at most 6 decimal places.
 */
export function isValidUsdcAmount(value: string): boolean {
  if (!value || value === '.') return false
  const num = parseFloat(value)
  if (isNaN(num) || num <= 0) return false
  const parts = value.split('.')
  if (parts.length === 2 && parts[1].length > 6) return false
  return true
}
