/**
 * Unit tests for payeeLabel.ts and verifyPayee.ts (normaliseDomain).
 * Run with:  bun scripts/test-payee-label.ts
 *
 * Uses no test framework — just asserts with descriptive errors.
 */
import { parseLabel, encodeLabel, encodedByteLength } from '../src/lib/payeeLabel'
import { normaliseDomain } from '../src/lib/verifyPayee'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failed++
  }
}

function eq<T>(a: T, b: T, msg: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
}

// ─── parseLabel ───────────────────────────────────────────────────────────────
console.log('\nparseLabel:')
eq(parseLabel('Halden Building Supplies @haldensupplies.com'),
   { name: 'Halden Building Supplies', domain: 'haldensupplies.com' },
   'parses name + domain')

eq(parseLabel('Halden Building Supplies'),
   { name: 'Halden Building Supplies' },
   'old label without domain')

eq(parseLabel('@haldensupplies.com'),
   { name: '@haldensupplies.com' },
   'lone @domain with no name → kept as name')

eq(parseLabel('  Trimmed name @example.org  '),
   { name: 'Trimmed name', domain: 'example.org' },
   'trims whitespace')

eq(parseLabel('Name @nodot'),
   { name: 'Name @nodot' },
   '@token without dot not treated as domain')

eq(parseLabel(''),
   { name: '' },
   'empty string')

eq(parseLabel('Name @a.b'),
   { name: 'Name', domain: 'a.b' },
   'short domain with dot')

// ─── encodeLabel ──────────────────────────────────────────────────────────────
console.log('\nencodeLabel:')
eq(encodeLabel('Halden Building Supplies', 'haldensupplies.com'),
   'Halden Building Supplies @haldensupplies.com',
   'encodes name + domain')

eq(encodeLabel('Halden Building Supplies'),
   'Halden Building Supplies',
   'encodes name only')

eq(encodeLabel('Halden Building Supplies', ''),
   'Halden Building Supplies',
   'empty domain → name only')

eq(encodeLabel('  Trimmed  ', 'example.org'),
   'Trimmed @example.org',
   'trims name')

eq(encodeLabel('Name', '@example.org'),
   'Name @example.org',
   'strips leading @ from domain arg')

// ─── round-trip ───────────────────────────────────────────────────────────────
console.log('\nround-trip:')
const cases = [
  { name: 'Halden Building Supplies', domain: 'haldensupplies.com' },
  { name: 'Brightline Electrical', domain: 'brightline.co.uk' },
  { name: 'Old label no domain', domain: undefined },
]
for (const { name, domain } of cases) {
  const encoded = encodeLabel(name, domain)
  const parsed = parseLabel(encoded)
  eq(parsed.name, name, `round-trip name: "${name}"`)
  eq(parsed.domain, domain, `round-trip domain: "${domain}"`)
}

// ─── encodedByteLength ───────────────────────────────────────────────────────
console.log('\nencodedByteLength:')
assert(encodedByteLength('Halden Building Supplies', 'haldensupplies.com') <= 48,
       'Halden + haldensupplies.com ≤ 48 bytes')
assert(encodedByteLength('A'.repeat(44), 'x.io') > 48,
       'long name + domain > 48 bytes (overflow detected)')

// ─── normaliseDomain ─────────────────────────────────────────────────────────
console.log('\nnormaliseDomain:')
function normOk(input: string, expected: string, label: string) {
  const r = normaliseDomain(input)
  assert(r.ok === true && r.ok && r.domain === expected, `${label}: "${input}" → "${expected}"`)
}
function normFail(input: string, label: string) {
  const r = normaliseDomain(input)
  assert(!r.ok, `${label}: "${input}" should be invalid`)
}

normOk('haldensupplies.com', 'haldensupplies.com', 'plain domain')
normOk('https://haldensupplies.com', 'haldensupplies.com', 'https scheme stripped')
normOk('http://www.haldensupplies.com/about?q=1', 'haldensupplies.com', 'full URL normalised')
normOk('HALDENSUPPLIES.COM', 'haldensupplies.com', 'uppercased')
normOk('www.example.org', 'example.org', 'www stripped')
normOk('sub.example.org', 'sub.example.org', 'subdomain kept')
normOk('haldensupplies.com.', 'haldensupplies.com', 'trailing dot stripped')
normFail('', 'empty')
normFail('xn--fiqs8s.com', 'punycode rejected')
normFail('localhost', 'no TLD')
normFail('a', 'single label')
normFail('has space.com', 'space in domain')

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
