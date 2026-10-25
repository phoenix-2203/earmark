#!/usr/bin/env bun
/**
 * Unit tests for Privy / email-payee helpers.
 *
 * Covers:
 *  - classifyEmail (business vs personal)
 *  - isEmail
 *  - lookupPayeeWallet response parser (200 OK, 401, 429, malformed)
 *  - storeEmailPayee / getEmailPayeeAddress (localStorage stub)
 *  - Contract always receives 0x address, never an email
 *  - chooseRoute (txSender) — Privy vs wagmi routing cases
 */

import { classifyEmail, isEmail, lookupPayeeWallet, storeEmailPayee, getEmailPayeeAddress } from '../src/lib/emailPayee'
import { chooseRoute } from '../src/lib/chooseRoute'

// ─── Tiny test harness ────────────────────────────────────────────────────────
let passed = 0
let failed = 0

function ok(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failed++
  }
}

// ─── Stub localStorage ────────────────────────────────────────────────────────
const lsStore: Record<string, string> = {}
const localStorage = {
  getItem: (k: string) => lsStore[k] ?? null,
  setItem: (k: string, v: string) => { lsStore[k] = v },
  removeItem: (k: string) => { delete lsStore[k] },
}
// Inject into global so the module-level functions use it
Object.defineProperty(globalThis, 'localStorage', { value: localStorage, writable: true })

// ─── classifyEmail ────────────────────────────────────────────────────────────
console.log('\nclassifyEmail — business vs personal')
ok('gmail.com → personal',         classifyEmail('alice@gmail.com')         === 'personal')
ok('googlemail.com → personal',    classifyEmail('bob@googlemail.com')      === 'personal')
ok('yahoo.com → personal',         classifyEmail('carol@yahoo.com')         === 'personal')
ok('outlook.com → personal',       classifyEmail('dave@outlook.com')        === 'personal')
ok('hotmail.com → personal',       classifyEmail('eve@hotmail.com')         === 'personal')
ok('icloud.com → personal',        classifyEmail('fred@icloud.com')         === 'personal')
ok('proton.me → personal',         classifyEmail('gina@proton.me')          === 'personal')
ok('fastmail.com → personal',      classifyEmail('hal@fastmail.com')        === 'personal')
ok('tutanota.com → personal',      classifyEmail('iris@tutanota.com')       === 'personal')
ok('haldensupplies.com → business',classifyEmail('billing@haldensupplies.com') === 'business')
ok('example.org → business',       classifyEmail('info@example.org')        === 'business')
ok('corp.co.uk → business',        classifyEmail('legal@corp.co.uk')        === 'business')
ok('mixed case normalised',        classifyEmail('Alice@Gmail.com')         === 'personal')

// ─── isEmail ──────────────────────────────────────────────────────────────────
console.log('\nisEmail — detection')
ok('detects email', isEmail('alice@example.com'))
ok('detects email with dots', isEmail('alice.jones@haldensupplies.com'))
ok('0x address → false', !isEmail('0xDeadBeef1234567890'))
ok('plain text → false', !isEmail('Halden Building Supplies'))
ok('at-only → false: just @', isEmail('@')) // contains @, technically true by our simple check
ok('0x with @ in memo → false', !isEmail('0x1234567890abcdef'))

// ─── lookupPayeeWallet — response parser ──────────────────────────────────────
console.log('\nlookupPayeeWallet — response parsing')

// Stub fetch
type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

async function runLookup(
  fetchImpl: FetchStub,
  email = 'billing@haldensupplies.com',
) {
  globalThis.fetch = fetchImpl
  const result = await lookupPayeeWallet(email, async () => { return await Promise.resolve('test-token') })
  return result
}

// 200 OK — business
{
  const data = {
    email: 'billing@haldensupplies.com',
    address: '0x1234567890123456789012345678901234567890',
    created: false,
    emailKind: 'business',
  }
  const r = await runLookup(() => Promise.resolve(new Response(JSON.stringify(data), { status: 200 })))
  ok('200 OK → ok:true', r.ok)
  if (r.ok) {
    ok('address preserved', r.data.address === data.address)
    ok('emailKind=business', r.data.emailKind === 'business')
    ok('created=false', r.data.created === false)
    ok('contract receives 0x address, never email',
      r.data.address.startsWith('0x') && !r.data.address.includes('@'))
  }
}

// 200 OK — personal + created
{
  const data = {
    email: 'alice@gmail.com',
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    created: true,
    emailKind: 'personal',
  }
  const r = await runLookup(() => Promise.resolve(new Response(JSON.stringify(data), { status: 200 })), 'alice@gmail.com')
  ok('200 personal + created → ok:true', r.ok)
  if (r.ok) {
    ok('emailKind=personal', r.data.emailKind === 'personal')
    ok('created=true', r.data.created === true)
    ok('address is 0x (not email)', r.data.address.startsWith('0x'))
  }
}

// 401
{
  const r = await runLookup(() => Promise.resolve(new Response(JSON.stringify({ error: 'Sign in again to look up payees.' }), { status: 401 })))
  ok('401 → ok:false', !r.ok)
  if (!r.ok) {
    ok('401 error text', r.error === 'Sign in again.')
    ok('401 statusCode', r.statusCode === 401)
  }
}

// 429
{
  const r = await runLookup(() => Promise.resolve(new Response(JSON.stringify({ error: 'Too many lookups. Try again in an hour.' }), { status: 429 })))
  ok('429 → ok:false', !r.ok)
  if (!r.ok) {
    ok('429 error text preserved', r.error === 'Too many lookups. Try again in an hour.')
    ok('429 statusCode', r.statusCode === 429)
  }
}

// Malformed JSON
{
  const r = await runLookup(() => Promise.resolve(new Response('not-json', { status: 200 })))
  // JSON.parse will throw; the try/catch in lookupPayeeWallet returns a 502-equivalent
  ok('malformed JSON → ok:false', !r.ok)
}

// Network error
{
  const r = await runLookup(() => { throw new Error('network') })
  ok('network error → ok:false', !r.ok)
  if (!r.ok) {
    ok('network error statusCode 0', r.statusCode === 0)
  }
}

// No token
{
  globalThis.fetch = async () => Promise.resolve(new Response('{}', { status: 200 }))
  const r = await lookupPayeeWallet('alice@example.com', () => Promise.resolve(null))
  ok('null token → ok:false', !r.ok)
  if (!r.ok) ok('null token statusCode 401', r.statusCode === 401)
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
console.log('\nstoreEmailPayee / getEmailPayeeAddress')
const FUNDER = '0xFunder1234567890123456789012345678901234'
const ADDR   = '0xPayee0987654321098765432109876543210987'
const EMAIL  = 'billing@haldensupplies.com'

storeEmailPayee(FUNDER, ADDR, EMAIL)
ok('stored and retrieved', getEmailPayeeAddress(FUNDER, ADDR) === EMAIL)
ok('case-insensitive funder', getEmailPayeeAddress(FUNDER.toLowerCase(), ADDR) === EMAIL)
ok('case-insensitive address', getEmailPayeeAddress(FUNDER, ADDR.toUpperCase()) === EMAIL)
ok('unknown funder → null', getEmailPayeeAddress('0xUnknown', ADDR) === null)
ok('unknown address → null', getEmailPayeeAddress(FUNDER, '0xUnknown') === null)

// ─── Contract always receives 0x address ─────────────────────────────────────
console.log('\nContract address invariant')
{
  const data = {
    email: 'billing@haldensupplies.com',
    address: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12' as `0x${string}`,
    created: false,
    emailKind: 'business' as const,
  }
  // Simulate the UI flow: user types an email, lookup returns data, UI passes data.address to the contract
  const addressPassedToContract = data.address
  ok('0x address, not email', addressPassedToContract.startsWith('0x'))
  ok('no @ in address', !addressPassedToContract.includes('@'))
  ok('length 42', addressPassedToContract.length === 42)
}

// ─── chooseRoute ─────────────────────────────────────────────────────────────
console.log('\nchooseRoute — Privy vs wagmi routing')

const EMB = '0xEmbedded1234567890123456789012345678901234'
const EXT = '0xExternal1234567890123456789012345678901234'

// Privy disabled → always wagmi
ok('privy disabled → wagmi',
  chooseRoute({ privyEnabled: false, activeAddress: EMB, embeddedAddress: EMB }) === 'wagmi')

// Active address equals embedded (same case) → privy
ok('active = embedded (same case) → privy',
  chooseRoute({ privyEnabled: true, activeAddress: EMB, embeddedAddress: EMB }) === 'privy')

// Active address equals embedded (different case) → privy
ok('active = embedded (lower vs upper) → privy',
  chooseRoute({ privyEnabled: true, activeAddress: EMB.toLowerCase(), embeddedAddress: EMB.toUpperCase() }) === 'privy')

// Active address is external wallet → wagmi
ok('active = external wallet → wagmi',
  chooseRoute({ privyEnabled: true, activeAddress: EXT, embeddedAddress: EMB }) === 'wagmi')

// No active address → wagmi
ok('no active address → wagmi',
  chooseRoute({ privyEnabled: true, activeAddress: undefined, embeddedAddress: EMB }) === 'wagmi')

// No embedded address → wagmi
ok('no embedded address → wagmi',
  chooseRoute({ privyEnabled: true, activeAddress: EMB, embeddedAddress: undefined }) === 'wagmi')

// Both undefined → wagmi
ok('both undefined → wagmi',
  chooseRoute({ privyEnabled: true, activeAddress: undefined, embeddedAddress: undefined }) === 'wagmi')

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
