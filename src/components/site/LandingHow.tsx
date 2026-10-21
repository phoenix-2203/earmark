/** Section 3 — How it works */
import { PiggyBank, CheckCircle2, Banknote, ReceiptText } from 'lucide-react'

const STEPS = [
  {
    n: 1,
    Icon: PiggyBank,
    title: 'Create a pot for one expense',
    desc: 'Set the purpose, amount, end date, and your recipient. Fund it with USDC on Arc.',
  },
  {
    n: 2,
    Icon: CheckCircle2,
    title: 'Approve who can be paid',
    desc: 'Add the exact addresses of the school, clinic, landlord, or supplier. Only these can receive money.',
  },
  {
    n: 3,
    Icon: Banknote,
    title: 'The recipient pays approved payees',
    desc: 'The recipient initiates payments from the pot. The contract blocks anything outside the approved list.',
  },
  {
    n: 4,
    Icon: ReceiptText,
    title: 'Anyone can verify the receipt',
    desc: 'Every payment is public on Arc. Share a link — no wallet needed to view the record.',
  },
]

export default function LandingHow() {
  return (
    <section id="how" className="py-16 md:py-20 bg-white scroll-mt-16">
      <div className="mx-auto max-w-[1040px] px-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          How it works
        </p>
        <h2
          className="display mb-10 text-center text-2xl font-semibold text-[var(--ink)] text-balance"
          style={{ letterSpacing: '-0.02em' }}
        >
          Four steps to purposeful money.
        </h2>
        <ol className="grid gap-5 sm:grid-cols-2">
          {STEPS.map(({ n, Icon, title, desc }) => (
            <li
              key={n}
              className="group flex gap-4 rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card"
            >
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span
                  className="flex size-8 items-center justify-center rounded-full text-sm font-bold transition-colors duration-150"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  aria-hidden
                >
                  {n}
                </span>
                <div className="flex-1 w-px bg-[var(--line)]" aria-hidden />
              </div>
              <div className="pb-1">
                <div className="mb-2 flex items-center gap-2">
                  <Icon
                    className="size-5 text-[var(--accent)] transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:text-[var(--accent-hover)]"
                    aria-hidden
                  />
                  <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
                </div>
                <p className="text-sm text-[var(--ink-2)] leading-relaxed">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
