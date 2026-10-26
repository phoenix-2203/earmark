/**
 * Unit tests for slug link helpers in src/lib/slugLinks.ts (pure functions only).
 * Run: bun run scripts/test-links.ts
 */

import { hashToSlug, slugMatches, isValidSlug } from '../src/lib/slugLinks'

let passed = 0
let failed = 0

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    console.error(`    expected: ${JSON.stringify(expected)}`)
    console.error(`    received: ${JSON.stringify(actual)}`)
    failed++
  }
}

console.log('\nhashToSlug')
expect('extracts first 12 hex chars', hashToSlug('0x7f3a9c2e41b0deadbeef1234'), '7f3a9c2e41b0')
expect('strips 0x prefix', hashToSlug('0xaabbccdd1122334455667788'), 'aabbccdd1122')
expect('lowercases output', hashToSlug('0xABCDEF012345'), 'abcdef012345')
expect('works without 0x', hashToSlug('7f3a9c2e41b0deadbeef1234'), '7f3a9c2e41b0')
expect('short hash returns available chars', hashToSlug('0xabcd'), 'abcd')

console.log('\nslugMatches')
const longHash = '0x7f3a9c2e41b0deadbeef12345678abcdef'
expect('matches slug at start', slugMatches(longHash, '7f3a9c2e41b0'), true)
expect('case-insensitive hash', slugMatches(longHash.toUpperCase(), '7f3a9c2e41b0'), true)
expect('case-insensitive slug', slugMatches(longHash, '7F3A9C2E41B0'), true)
expect('rejects wrong slug', slugMatches(longHash, 'aabbccddeeff'), false)
expect('rejects short match only in middle', slugMatches('0xdeadbeef7f3a9c2e41b0', '7f3a9c2e41b0'), false)
expect('matches full hash as slug prefix', slugMatches('0xabcdef012345rest', 'abcdef012345'), true)

console.log('\nisValidSlug')
expect('12 hex chars valid', isValidSlug('7f3a9c2e41b0'), true)
expect('11 chars invalid', isValidSlug('7f3a9c2e41b'), false)
expect('13 chars invalid', isValidSlug('7f3a9c2e41b0a'), false)
expect('uppercase invalid', isValidSlug('7F3A9C2E41B0'), false)
expect('non-hex chars invalid', isValidSlug('7f3a9c2e41g0'), false)
expect('empty string invalid', isValidSlug(''), false)
expect('all zeros valid', isValidSlug('000000000000'), true)
expect('all f valid', isValidSlug('ffffffffffff'), true)

// slug derived from hashToSlug should always be valid
expect('hashToSlug result is valid slug', isValidSlug(hashToSlug('0xabcdef0123456789abcdef01')), true)

const totalTests = passed + failed
console.log(`\n${passed}/${totalTests} tests passed.`)
if (failed > 0) process.exit(1)
