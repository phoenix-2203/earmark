/** Section 7 — Why Arc */
import { Coins, Zap, Globe } from 'lucide-react'
import { EARMARK_CHAIN } from '@/earmarkConfig'

const WHY = [
  {
    Icon: Coins,
    title: 'Fees paid in USDC',
    desc: 'On Arc the gas fee is taken from your USDC balance — you never need to buy a separate network token.',
  },
  {
    Icon: Zap,
    title: 'Settles in under a second',
    desc: 'Arc\'s sub-second finality means the recipient sees the payment confirmed almost instantly.',
  },
  {
    Icon: Globe,
    title: 'Every payment is a public record',
    desc: `Each payment from a pot is permanently recorded on ${EARMARK_CHAIN.name} and viewable on explorer.arc.io — no account needed.`,
  },
]

export default function LandingWhyArc() {
  return (
    <section className="py-16 md:py-20 bg-[var(--surface)]">
      <div className="mx-auto max-w-[1040px] px-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Why Arc
        </p>
        <h2
          className="display mb-10 text-center text-2xl font-semibold text-[var(--ink)] text-balance"
          style={{ letterSpacing: '-0.02em' }}
        >
          Built on Arc so fees never get in the way.
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {WHY.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="group rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card"
            >
              <div className="mb-3 inline-flex items-center justify-center rounded-lg bg-[var(--accent-soft)] p-2.5 transition-transform duration-150 group-hover:-translate-y-0.5">
                <Icon className="size-5 text-[var(--accent)] group-hover:text-[var(--accent-hover)] transition-colors duration-150" aria-hidden />
              </div>
              <h3 className="mb-1.5 text-sm font-semibold text-[var(--ink)]">{title}</h3>
              <p className="text-sm text-[var(--ink-2)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
