import { ArrowRight, ShieldCheck, GraduationCap, CheckCircle2, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  onSend: () => void
  onMyPots: () => void
  onForMe: () => void
  onHow: () => void
}

export default function HomePage({ onSend, onMyPots, onForMe, onHow }: Props) {
  return (
    <main className="mx-auto max-w-content px-4 pb-32 pt-12 md:pb-16 md:pt-16">
      {/* ── Hero ── */}
      <div className="mb-12 max-w-lg">
        <h1 className="display mb-3 text-4xl font-semibold text-[var(--ink)] text-balance" style={{ letterSpacing: '-0.025em' }}>
          Money with a purpose.
        </h1>
        <p className="text-base text-[var(--ink-2)] text-pretty leading-relaxed">
          Fund a pot in USDC for one expense. The recipient can only pay the payees you
          approve — and every payment leaves a public receipt on Arc.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" onClick={onSend} className="w-full sm:w-auto">
            <PotIcon className="size-4" aria-hidden />
            Create a pot
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <div className="flex gap-4 text-sm font-medium text-[var(--accent)]">
            <button onClick={onForMe} className="hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded">
              I'm a recipient
            </button>
            <span className="text-[var(--line)]">·</span>
            <button onClick={onHow} className="hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded">
              How it works
            </button>
          </div>
        </div>
      </div>

      {/* ── Used for ── */}
      <section className="mb-10" aria-labelledby="used-for-heading">
        <p id="used-for-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Used for
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            'Money sent home — school fees, rent, medical bills',
            'Staff allowances and per diems',
            'Grants and scholarships',
            'Supplier and project budgets',
          ].map((example) => (
            <li
              key={example}
              className="flex items-start gap-2 rounded-card border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-2)] shadow-card"
            >
              <span className="mt-0.5 text-[var(--accent)]" aria-hidden>→</span>
              {example}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 3-step strip ── */}
      <section className="mb-12" aria-labelledby="steps-heading">
        <p id="steps-heading" className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          How it works
        </p>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            {
              n: 1,
              Icon: GraduationCap,
              title: 'Create a pot for one expense',
              desc: 'Set the purpose, amount, end date, and which payees are approved. Fund it with USDC.',
            },
            {
              n: 2,
              Icon: CheckCircle2,
              title: 'Approve who can be paid',
              desc: 'Only the addresses you choose — a school, supplier, clinic, or landlord — can receive money from the pot.',
            },
            {
              n: 3,
              Icon: ReceiptText,
              title: 'The recipient pays; anyone can verify',
              desc: 'The recipient pays approved payees directly. Every payment is recorded on Arc with a public receipt.',
            },
          ].map(({ n, Icon, title, desc }) => (
            <li
              key={n}
              className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card"
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  aria-hidden
                >
                  {n}
                </span>
                <Icon className="size-4 shrink-0 text-[var(--accent)]" aria-hidden />
                <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted)] text-pretty">{desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── What Earmark does / doesn't do ── */}
      <section
        className="mb-10 rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card"
        aria-labelledby="does-heading"
      >
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-5 text-[var(--accent)]" aria-hidden />
          <h2 id="does-heading" className="text-sm font-semibold text-[var(--ink)]">What Earmark does and doesn't do</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--success)]">Does</p>
            <ul className="space-y-1.5 text-xs text-[var(--ink-2)]">
              <li className="flex gap-2"><span className="text-[var(--success)]">✓</span> Only lets the pot pay addresses the funder approved</li>
              <li className="flex gap-2"><span className="text-[var(--success)]">✓</span> Records every payment on Arc with a memo</li>
              <li className="flex gap-2"><span className="text-[var(--success)]">✓</span> Returns unspent money to the funder after the end date</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-danger">Doesn't</p>
            <ul className="space-y-1.5 text-xs text-[var(--ink-2)]">
              <li className="flex gap-2"><span className="text-danger">✗</span> Verify who owns an address (confirm it directly with the payee)</li>
              <li className="flex gap-2"><span className="text-danger">✗</span> Reverse a payment once confirmed</li>
              <li className="flex gap-2"><span className="text-danger">✗</span> Work with tokens other than USDC</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Secondary links ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={onMyPots}
          className="flex items-center justify-between rounded-card border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm font-semibold text-[var(--ink)] shadow-card hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        >
          Pots I fund
          <ArrowRight className="size-4 text-[var(--muted)]" aria-hidden />
        </button>
        <button
          onClick={onForMe}
          className="flex items-center justify-between rounded-card border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm font-semibold text-[var(--ink)] shadow-card hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        >
          Pots for me
          <ArrowRight className="size-4 text-[var(--muted)]" aria-hidden />
        </button>
      </div>
    </main>
  )
}

// Inline pot/piggy icon
function PotIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24" height="24"
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h2v2h4v-4.5c2-1.5 2.5-2.5 2.5-4.5v-1H22V9h-3V7c0-1.1.9-2 2-2V5Z"/>
    </svg>
  )
}
