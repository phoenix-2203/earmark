/**
 * "How it's different" comparison section.
 * Desktop: accessible <table> with Earmark column highlighted.
 * Mobile (<768px): three stacked cards, Earmark first.
 */
import { CheckCircle2 } from 'lucide-react'

const ROWS = [
  {
    aspect: 'Who controls the money after sending',
    transfer: 'The recipient, fully',
    escrow:   'Nobody, until a condition is met',
    earmark:  'The recipient spends it, but only to approved payees',
  },
  {
    aspect: 'Can it be spent on something else?',
    transfer: 'Yes',
    escrow:   'Not applicable',
    earmark:  'No — blocked by the contract',
  },
  {
    aspect: 'Proof of where it went',
    transfer: 'No',
    escrow:   'Partly',
    earmark:  'A public receipt for every payment',
  },
  {
    aspect: 'Unspent money',
    transfer: 'Stays with the recipient',
    escrow:   'Returned or released',
    earmark:  'Back to the funder after the end date',
  },
]

export default function LandingDifferent() {
  return (
    <section
      id="different"
      className="border-b border-[var(--line)] bg-[var(--surface)]"
      aria-labelledby="diff-heading"
    >
      <div className="mx-auto max-w-[1040px] px-4 py-16 sm:py-20">
        <h2
          id="diff-heading"
          className="mb-10 text-2xl font-semibold text-[var(--ink)] sm:text-3xl"
          style={{ letterSpacing: '-0.02em' }}
        >
          How it's different
        </h2>

        {/* ── Desktop table (hidden on mobile) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-sm" aria-label="Comparison: normal transfer vs escrow vs Earmark">
            <thead>
              <tr>
                <th scope="col" className="w-[30%] pb-3 text-left text-xs font-semibold uppercase tracking-widest text-[var(--muted)]" />
                <th scope="col" className="w-[23%] pb-3 text-left text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Normal transfer</th>
                <th scope="col" className="w-[23%] pb-3 text-left text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Escrow</th>
                <th scope="col" className="w-[24%] rounded-t-lg pb-3 pl-4 text-left text-sm font-bold"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" aria-hidden /> Earmark
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ aspect, transfer, escrow, earmark }, i) => {
                const isLast = i === ROWS.length - 1
                return (
                  <tr key={aspect} className="border-t border-[var(--line)]">
                    <td className="py-4 pr-4 font-medium text-[var(--ink)]">{aspect}</td>
                    <td className="py-4 pr-4 text-[var(--ink-2)]">{transfer}</td>
                    <td className="py-4 pr-4 text-[var(--ink-2)]">{escrow}</td>
                    <td
                      className={`py-4 pl-4 font-semibold ${isLast ? 'rounded-b-lg' : ''}`}
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                    >
                      {earmark}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards (shown only on mobile) ── */}
        <div className="space-y-4 md:hidden">
          {/* Earmark first, highlighted */}
          <div
            className="rounded-card border-2 p-4 shadow-card"
            style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}
          >
            <p className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: 'var(--accent)' }}>
              <CheckCircle2 className="size-4" aria-hidden /> Earmark
            </p>
            <dl className="space-y-3">
              {ROWS.map(({ aspect, earmark }) => (
                <div key={aspect}>
                  <dt className="text-xs font-semibold text-[var(--muted)]">{aspect}</dt>
                  <dd className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--accent)' }}>{earmark}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Normal transfer */}
          <div className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card">
            <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Normal transfer</p>
            <dl className="space-y-3">
              {ROWS.map(({ aspect, transfer }) => (
                <div key={aspect}>
                  <dt className="text-xs font-semibold text-[var(--muted)]">{aspect}</dt>
                  <dd className="mt-0.5 text-sm text-[var(--ink-2)]">{transfer}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Escrow */}
          <div className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card">
            <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Escrow</p>
            <dl className="space-y-3">
              {ROWS.map(({ aspect, escrow }) => (
                <div key={aspect}>
                  <dt className="text-xs font-semibold text-[var(--muted)]">{aspect}</dt>
                  <dd className="mt-0.5 text-sm text-[var(--ink-2)]">{escrow}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
