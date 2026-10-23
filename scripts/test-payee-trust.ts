/**
 * Unit tests for Part A (confirmPayee) and Part B (free-host matcher).
 * Run with: bun scripts/test-payee-trust.ts
 */

import { isFreeHost, normaliseDomain } from '../src/lib/verifyPayee'
import {
  generateCode, formatCode, encodeRequest, decodeRequest,
  buildConfirmMessage, isRequestExpired, CONFIRM_TTL_SECS,
} from '../src/lib/confirmPayee'
import type { ConfirmRequest } from '../src/lib/confirmPayee'

let passed = 0
let failed = 0

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${label}`)
    failed++
  }
}

function assertEqual<T>(label: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

// ─── Part B: free-host matcher ────────────────────────────────────────────────

console.log('\nPart B — free-host matcher')

assert('a.duckdns.org is free (subdomain)',     !!isFreeHost('a.duckdns.org'))
assert('duckdns.org is free (apex)',             !!isFreeHost('duckdns.org'))
assert('myduckdns.org is NOT free',              !isFreeHost('myduckdns.org'))
assert('halden.github.io is free (subdomain)',   !!isFreeHost('halden.github.io'))
assert('github.io is free (apex)',               !!isFreeHost('github.io'))
assert('haldensupplies.com is NOT free',         !isFreeHost('haldensupplies.com'))
assert('foo.vercel.app is free',                 !!isFreeHost('foo.vercel.app'))
assert('vercel.app is free (apex)',              !!isFreeHost('vercel.app'))
assert('myvercel.app is NOT free',               !isFreeHost('myvercel.app'))
assert('sub.netlify.app is free',                !!isFreeHost('sub.netlify.app'))
assert('netlifyapp.com is NOT free',             !isFreeHost('netlifyapp.com'))
assert('test.fly.dev is free',                   !!isFreeHost('test.fly.dev'))
assert('flydev.com is NOT free',                 !isFreeHost('flydev.com'))

// ─── Domain normalisation ─────────────────────────────────────────────────────

console.log('\nPart B — normaliseDomain')

{
  const r = normaliseDomain('https://www.haldensupplies.com/about?q=1')
  assert('normalise strips scheme+www+path', r.ok && r.domain === 'haldensupplies.com')
}
{
  const r = normaliseDomain('xn--ls8h.la')
  assert('punycode rejected', !r.ok)
}
{
  const r = normaliseDomain('  haldensupplies.com.  ')
  assert('trailing dot + spaces', r.ok && r.domain === 'haldensupplies.com')
}

// ─── Part A: code generation ──────────────────────────────────────────────────

console.log('\nPart A — generateCode / formatCode')

{
  const code = generateCode()
  assert('code is 8 chars', code.length === 8)
  assert('code is uppercase', code === code.toUpperCase())
  assert('code has no 0/O/1/I', !/[01IO]/.test(code))
  const formatted = formatCode(code)
  assert('formatCode inserts dash at pos 4', formatted[4] === '-')
  assert('formatCode total length 9', formatted.length === 9)
}

// ─── Part A: request encode/decode round-trip ─────────────────────────────────

console.log('\nPart A — request encode/decode')

const SAMPLE_REQ: ConfirmRequest = {
  v: 1,
  chainId: 5042002,
  funder: '0xAaBbCcDdEeFf0011223344556677889900112233',
  payee:  '0x1234567890AbCdEf1234567890AbCdEf12345678',
  name:   'Halden Building Supplies',
  purpose: 'Office fit-out \u00B7 Phase 1',  // contains non-ASCII middot
  code:   'ABCD2345',
  exp:    Math.floor(Date.now() / 1000) + 3600,
}

{
  const encoded = encodeRequest(SAMPLE_REQ)
  assert('encoded is non-empty string', typeof encoded === 'string' && encoded.length > 0)
  assert('encoded has no + or /', !/[+/]/.test(encoded))

  const decoded = decodeRequest(encoded)
  assert('decoded is not null', decoded !== null)
  if (decoded) {
    assertEqual('decoded.v matches',         decoded.v,         SAMPLE_REQ.v)
    assertEqual('decoded.chainId matches',   decoded.chainId,   SAMPLE_REQ.chainId)
    assertEqual('decoded.funder matches',    decoded.funder,    SAMPLE_REQ.funder)
    assertEqual('decoded.payee matches',     decoded.payee,     SAMPLE_REQ.payee)
    assertEqual('decoded.name matches',      decoded.name,      SAMPLE_REQ.name)
    assertEqual('decoded.purpose matches',   decoded.purpose,   SAMPLE_REQ.purpose)
    assertEqual('decoded.code matches',      decoded.code,      SAMPLE_REQ.code)
    assertEqual('decoded.exp matches',       decoded.exp,       SAMPLE_REQ.exp)
  }
}

{
  const bad = decodeRequest('!!!not-base64!!!')
  assert('malformed input returns null', bad === null)
}

{
  // Valid base64 but not a v:1 object
  const notV1 = btoa(JSON.stringify({ v: 2, foo: 'bar' }))
  assert('v:2 object returns null', decodeRequest(notV1) === null)
}

// ─── Part A: exact message builder ───────────────────────────────────────────

console.log('\nPart A — buildConfirmMessage')

{
  const msg = buildConfirmMessage(SAMPLE_REQ)
  assert('message starts with Earmark payee confirmation', msg.startsWith('Earmark payee confirmation\n'))
  assert('message contains wallet', msg.includes(`Wallet: ${SAMPLE_REQ.payee}`))
  assert('message contains funder', msg.includes(`Requested by: ${SAMPLE_REQ.funder}`))
  assert('message contains code', msg.includes(`Code: ${SAMPLE_REQ.code}`))
  assert('message contains chainId', msg.includes(`Network: ${SAMPLE_REQ.chainId}`))
  assert('message contains purpose', msg.includes(`For: ${SAMPLE_REQ.purpose}`))
  assert('message contains name', msg.includes(`I confirm this wallet belongs to: ${SAMPLE_REQ.name}`))
  // Must be 7 lines
  assert('message has exactly 7 lines', msg.split('\n').length === 7)
}

// ─── Part A: expiry ───────────────────────────────────────────────────────────

console.log('\nPart A — expiry')

{
  const notExpired: ConfirmRequest = { ...SAMPLE_REQ, exp: Math.floor(Date.now() / 1000) + 100 }
  assert('not expired when exp is in the future', !isRequestExpired(notExpired))
}
{
  const expired: ConfirmRequest = { ...SAMPLE_REQ, exp: Math.floor(Date.now() / 1000) - 1 }
  assert('expired when exp is in the past', isRequestExpired(expired))
}
{
  // TTL constant
  assert('CONFIRM_TTL_SECS is 7 days', CONFIRM_TTL_SECS === 7 * 24 * 60 * 60)
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
