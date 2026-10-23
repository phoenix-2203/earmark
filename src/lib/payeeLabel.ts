/**
 * payeeLabel — encode/parse the "@domain" suffix in payee labels.
 *
 * On-chain the payee label is a string ≤ 48 bytes (enforced by the contract).
 * We store the domain as a suffix: "<name> @<domain>".
 * Old labels without the suffix are parsed as {name: label, domain: undefined}.
 *
 * Rules:
 * - The suffix is the LAST whitespace-separated token that starts with "@" and
 *   contains at least one dot.
 * - Everything before the suffix (trimmed) is the name.
 * - The "@" prefix is never shown to the user — the component shows the domain
 *   next to the name (as a badge), never the raw "@…" text.
 *
 * Max encoded label: 48 bytes (contract limit).
 * This module only encodes/parses strings; validation of the combined length
 * is the caller's responsibility.
 */

export interface ParsedLabel {
  name: string
  domain?: string
}

/**
 * Parse a raw on-chain label string into {name, domain?}.
 */
export function parseLabel(label: string): ParsedLabel {
  const trimmed = label.trim()
  if (!trimmed) return { name: '' }

  const parts = trimmed.split(/\s+/)
  const last = parts[parts.length - 1]

  // Domain suffix: starts with "@", contains a dot, at least 4 chars (e.g. @a.bc)
  if (last.startsWith('@') && last.includes('.') && last.length >= 4) {
    const domain = last.slice(1) // strip "@"
    const name = parts.slice(0, -1).join(' ').trim()
    if (name) return { name, domain }
  }

  return { name: trimmed }
}

/**
 * Encode a name and optional domain into the on-chain label string.
 * Returns "<name>" when domain is absent, "<name> @<domain>" when present.
 */
export function encodeLabel(name: string, domain?: string): string {
  const n = name.trim()
  if (!domain) return n
  const d = domain.trim().replace(/^@/, '')
  if (!d || !d.includes('.')) return n
  return `${n} @${d}`
}

/**
 * Byte-length of the encoded label (contracts enforce ≤ 48 bytes via UTF-8).
 * ASCII-only domains keep it simple; most names are ASCII too.
 */
export function encodedByteLength(name: string, domain?: string): number {
  const encoded = encodeLabel(name, domain)
  return new TextEncoder().encode(encoded).length
}
