/**
 * Unit tests for Part A (confirmPayee) and Part B (free-host matcher).
 * Run with: bun scripts/test-payee-trust.ts
 */

import { isFreeHost, normaliseDomain } from '../src/lib/verifyPayee'
import {
  generateCode, formatCode, encodeRequest, decodeRequest,
  buildConfirmMessage, isRequestExpired, CONFIRM_TTL_SECS,
  verifyReply, type ConfirmRequest, type ConfirmStorage,
} from '../src/lib/confirmPayee'
import { privateKeyToAccount } from 'viem/accounts'
import { signMessage } from 'viem/actions'
import { createWalletClient, http, verifyMessage } from 'viem'
import { mainnet } from 'viem/chains'

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

// ─── Part A: verifyReply security tests ──────────────────────────────────────
//
// Uses two Anvil test accounts:
//   FUNDER  = Anvil account 0  (0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266)
//   PAYEE   = Anvil account 1  (0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
//   ATTACKER= Anvil account 2  (0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC)
//
// We stub publicClient.verifyMessage with a pure viem verifyMessage call (no RPC
// needed — viem can verify EOA signatures locally without a blockchain).

console.log('\nPart A — verifyReply security tests')

const FUNDER_KEY    = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
const PAYEE_KEY     = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const
const ATTACKER_KEY  = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as const

const funderAccount   = privateKeyToAccount(FUNDER_KEY)
const payeeAccount    = privateKeyToAccount(PAYEE_KEY)
const attackerAccount = privateKeyToAccount(ATTACKER_KEY)

const CHAIN_ID = 5042002  // Arc Testnet — matches SAMPLE_REQ

/** Build a wallet client for signing (mainnet chain object, no RPC used for signing). */
function walletClient(account: ReturnType<typeof privateKeyToAccount>) {
  return createWalletClient({ account, chain: mainnet, transport: http() })
}

/** Sign a message with the given account. */
async function sign(account: ReturnType<typeof privateKeyToAccount>, message: string): Promise<`0x${string}`> {
  return signMessage(walletClient(account), { account, message })
}

/** viem local verifyMessage (no RPC — works for EOA signatures in tests). */
async function localVerify(args: { address: `0x${string}`; message: string; signature: `0x${string}` }): Promise<boolean> {
  try {
    return await verifyMessage(args)
  } catch {
    return false
  }
}

/** Build a minimal in-memory ConfirmStorage with a single stored request. */
function makeStorage(stored: ConfirmRequest): ConfirmStorage & { confirmed: Record<string, unknown>; deleted: string[] } {
  const map: Record<string, ConfirmRequest> = { [stored.code]: stored }
  const confirmed: Record<string, unknown> = {}
  const deleted: string[] = []
  return {
    getRequest: (code) => map[code] ?? null,
    deleteRequest: (code) => { deleted.push(code); delete map[code] },
    storeConfirmed: (f, p, n, c) => { confirmed[`${f.toLowerCase()}:${p.toLowerCase()}`] = { p, n, c } },
    confirmed,
    deleted,
  }
}

/** Build a valid ConfirmRequest for FUNDER → PAYEE. */
function makeReq(overrides: Partial<ConfirmRequest> = {}): ConfirmRequest {
  return {
    v: 1,
    chainId: CHAIN_ID,
    funder: funderAccount.address,
    payee: payeeAccount.address,
    name: 'Halden Building Supplies',
    purpose: 'Office fit-out Phase 1',
    code: 'TESTCD99',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  }
}

{
  // (a) Valid reply → ok; code is deleted (single-use); stored fields come from storage not link
  const req = makeReq()
  const sig = await sign(payeeAccount, buildConfirmMessage(req))
  const storage = makeStorage(req)
  const encoded = encodeRequest(req)
  const result = await verifyReply(encoded, sig, funderAccount.address, undefined, localVerify, storage)
  assert('(a) valid reply → ok', result.ok)
  if (result.ok) {
    assert('(a) stored.name comes from storage', result.stored.name === req.name)
    assert('(a) stored.payee comes from storage', result.stored.payee.toLowerCase() === payeeAccount.address.toLowerCase())
  }
  assert('(a) code deleted after success (single-use)', storage.deleted.includes(req.code))
}

{
  // (b) Attacker swaps their own address into a link with the same code, signs with their key
  const req = makeReq()
  // Craft a poisoned link: same code, but payee = attacker
  const poisonedReq: ConfirmRequest = { ...req, payee: attackerAccount.address }
  const attackerSig = await sign(attackerAccount, buildConfirmMessage(poisonedReq))
  const storage = makeStorage(req)  // storage has the REAL req (payee = payeeAccount)
  const encodedPoison = encodeRequest(poisonedReq)
  const result = await verifyReply(encodedPoison, attackerSig, funderAccount.address, undefined, localVerify, storage)
  assert('(b) attacker payee swap → rejected (field mismatch)', !result.ok)
  if (!result.ok) assert('(b) reason mentions request mismatch', result.reason.includes("doesn't match"))
}

{
  // (c) Name changed in the link (link.name !== stored.name)
  const req = makeReq()
  const tamperedReq: ConfirmRequest = { ...req, name: 'Evil Corp' }
  const sig = await sign(payeeAccount, buildConfirmMessage(tamperedReq))
  const storage = makeStorage(req)
  const encoded = encodeRequest(tamperedReq)
  const result = await verifyReply(encoded, sig, funderAccount.address, undefined, localVerify, storage)
  assert('(c) name changed in link → rejected (field mismatch)', !result.ok)
}

{
  // (d) Unknown code (not in this browser's localStorage)
  const req = makeReq({ code: 'UNKNWN99' })
  const sig = await sign(payeeAccount, buildConfirmMessage(req))
  // Storage has a DIFFERENT code
  const storage = makeStorage(makeReq({ code: 'DIFFR123' }))
  const encoded = encodeRequest(req)
  const result = await verifyReply(encoded, sig, funderAccount.address, undefined, localVerify, storage)
  assert('(d) unknown code → rejected', !result.ok)
  if (!result.ok) assert('(d) reason mentions not requested from this browser', result.reason.includes("wasn't requested"))
}

{
  // (e) Reply is for a different payee row (expectedPayee mismatch)
  const req = makeReq()
  const sig = await sign(payeeAccount, buildConfirmMessage(req))
  const storage = makeStorage(req)
  const encoded = encodeRequest(req)
  const wrongExpected = attackerAccount.address
  const result = await verifyReply(encoded, sig, funderAccount.address, wrongExpected, localVerify, storage)
  assert('(e) wrong expectedPayee → rejected', !result.ok)
  if (!result.ok) assert('(e) reason mentions different wallet', result.reason.includes('different wallet'))
}

{
  // (f) Code reuse — second call after first call succeeds should fail
  const req = makeReq()
  const sig = await sign(payeeAccount, buildConfirmMessage(req))
  const storage = makeStorage(req)
  const encoded = encodeRequest(req)
  // First call succeeds
  const first = await verifyReply(encoded, sig, funderAccount.address, undefined, localVerify, storage)
  assert('(f) first call succeeds', first.ok)
  // Second call — code was deleted
  const second = await verifyReply(encoded, sig, funderAccount.address, undefined, localVerify, storage)
  assert('(f) second call (code reuse) → rejected', !second.ok)
  if (!second.ok) assert('(f) reason mentions not requested from this browser', second.reason.includes("wasn't requested"))
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
