/**
 * Section 4 — Try the rules (interactive simulator, no wallet).
 * Mirrors the exact contract rules from Earmark.sol.
 */
import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface RuleTest {
  label: string
  result: 'allowed' | 'blocked'
  rule: string
}

const FUNDER   = '0xF000…0001'
const RECIPIENT = '0xRE00…0002'
const BALANCE_USDC = 500

const TESTS: RuleTest[] = [
  {
    label: 'Pay Greenfield School (approved payee)',
    result: 'allowed',
    rule: 'The payee is on the approved list and the pot has enough balance.',
  },
  {
    label: 'Pay City Clinic (approved payee)',
    result: 'allowed',
    rule: 'The payee is on the approved list and the pot has enough balance.',
  },
  {
    label: "Pay the recipient's own wallet",
    result: 'blocked',
    rule: 'BeneficiaryCannotBePayee — the recipient can\'t be a payee of this pot.',
  },
  {
    label: 'Pay an unknown address',
    result: 'blocked',
    rule: 'PayeeNotApproved — only approved payees can be paid.',
  },
  {
    label: `Pay 999 USDC (more than the ${BALANCE_USDC} USDC balance)`,
    result: 'blocked',
    rule: 'InsufficientBalance — amount exceeds the pot balance.',
  },
  {
    label: 'Pay after the end date',
    result: 'blocked',
    rule: 'PotExpired — this pot has ended; no more payments are possible.',
  },
]

export default function LandingTryRules() {
  const [selected, setSelected] = useState<number | null>(null)

  const test = selected !== null ? TESTS[selected] : null

  return (
    <section className="py-16 md:py-20" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[1040px] px-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Interactive
        </p>
        <h2
          className="display mb-3 text-center text-2xl font-semibold text-[var(--ink)] text-balance"
          style={{ letterSpacing: '-0.02em' }}
        >
          See what the contract allows.
        </h2>
        <p className="mb-8 text-center text-sm text-[var(--ink-2)]">
          Simulation — no transaction is sent.
        </p>

        <div className="mx-auto max-w-lg rounded-card border border-[var(--line)] bg-[var(--surface)] shadow-card overflow-hidden">
          {/* Pot header */}
          <div className="border-b border-[var(--line)] bg-[var(--accent-soft)] px-5 py-4">
            <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-1">Example pot</p>
            <p className="text-sm font-semibold text-[var(--ink)]">School fees — Term 1</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-2)]">
              <span>Funder: <span className="font-mono">{FUNDER}</span></span>
              <span>Recipient: <span className="font-mono">{RECIPIENT}</span></span>
              <span>Balance: <span className="font-semibold">{BALANCE_USDC} USDC</span></span>
            </div>
            <div className="mt-1.5 flex gap-3 text-xs text-[var(--muted)]">
              <span>Approved: <span className="text-[var(--success)]">Greenfield School</span>, <span className="text-[var(--success)]">City Clinic</span></span>
            </div>
          </div>

          {/* Test buttons */}
          <div className="divide-y divide-[var(--line)]">
            {TESTS.map((t, i) => (
              <button
                key={i}
                onClick={() => setSelected(selected === i ? null : i)}
                aria-pressed={selected === i}
                className={`w-full flex items-center justify-between px-5 py-3.5 text-left text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--focus)]
                  ${selected === i
                    ? t.result === 'allowed'
                      ? 'bg-[#E6FFF4]'
                      : 'bg-[#FDECEC]'
                    : 'hover:bg-[var(--surface-2)]'
                  }`}
              >
                <span className={`font-medium ${selected === i ? (t.result === 'allowed' ? 'text-[var(--success)]' : 'text-[var(--danger)]') : 'text-[var(--ink)]'}`}>
                  {t.label}
                </span>
                {selected === i && (
                  t.result === 'allowed'
                    ? <CheckCircle2 className="size-4 shrink-0 text-[var(--success)] ml-2" aria-hidden />
                    : <XCircle className="size-4 shrink-0 text-[var(--danger)] ml-2" aria-hidden />
                )}
              </button>
            ))}
          </div>

          {/* Result panel */}
          {test && (
            <div
              className={`border-t px-5 py-4 text-sm ${
                test.result === 'allowed'
                  ? 'border-[var(--success)] bg-[#E6FFF4] text-[var(--success)]'
                  : 'border-[var(--danger)] bg-[#FDECEC] text-[var(--danger)]'
              }`}
              aria-live="polite"
            >
              <span className="font-semibold">{test.result === 'allowed' ? '✓ Allowed' : '✕ Blocked'}</span>
              <span className="ml-2 text-[var(--ink-2)]">{test.rule}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
