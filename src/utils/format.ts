import { USDC_DECIMALS_LOCAL } from '@/earmarkConfig'

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
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Format a unix timestamp as a human-readable date */
export function formatDate(ts: bigint | number): string {
  return new Date(Number(ts) * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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
