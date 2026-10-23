/** Section 8 — Safety */
import { ShieldCheck, AlertTriangle, Github } from 'lucide-react'
import { EARMARK_CHAIN, EARMARK_ADDRESS } from '@/earmarkConfig'

export default function LandingSafety() {
  const explorerUrl = `${EARMARK_CHAIN.explorerBase}/address/${EARMARK_ADDRESS}`
  const githubUrl = 'https://github.com/phoenix-2203/earmark/blob/main/contracts/Earmark.sol'

  return (
    <section id="safety" className="py-16 md:py-20 scroll-mt-16" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[1040px] px-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Safety
        </p>
        <h2
          className="display mb-10 text-center text-2xl font-semibold text-[var(--ink)] text-balance"
          style={{ letterSpacing: '-0.02em' }}
        >
          What the contract can and can't do.
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 mb-8">
          {/* Does */}
          <div className="rounded-card border border-[var(--success)] bg-[#E6FFF4] p-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-5 text-[var(--success)]" aria-hidden />
              <h3 className="text-sm font-semibold text-[var(--success)]">What the contract enforces</h3>
            </div>
            <ul className="space-y-2.5">
              {[
                'Only approved payees can receive money from a pot',
                'The funder and recipient can never be a payee of their own pot',
                'No owner address, no admin key, no upgrade mechanism',
                'No platform fees are taken',
                'Unspent money returns to the funder after the end date',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[var(--ink)]">
                  <span className="mt-0.5 shrink-0 font-bold text-[var(--success)]">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Doesn't */}
          <div className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="size-5 text-[var(--warning)]" aria-hidden />
              <h3 className="text-sm font-semibold text-[var(--ink)]">What it can't do</h3>
            </div>
            <ul className="space-y-2.5">
              {[
                'Verify a payee you never contacted yourself — domain badges and wallet confirmations are evidence, not substitutes for reaching out through channels you found',
                'Reverse a payment once it has been confirmed',
                'Work with tokens other than USDC',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[var(--ink-2)]">
                  <span className="mt-0.5 shrink-0 text-[var(--warning)]">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Audit banner */}
        <div className="rounded-card border border-[#F5C6C3] bg-[#FDECEC] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--danger)] font-medium">
            ⚠ Experimental — not independently audited. Use small amounts and treat funds as at risk.
          </p>
          <div className="flex gap-3">
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
            >
              Contract on explorer
            </a>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
            >
              <Github className="size-4" aria-hidden />
              Earmark.sol
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
