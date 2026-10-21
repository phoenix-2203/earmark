/** Section 2 — The Problem */
import { AlertTriangle, Search, HelpCircle } from 'lucide-react'

const PROBLEMS = [
  {
    Icon: AlertTriangle,
    title: 'School fees that never reach the school',
    desc: 'Money sent for a specific purpose is easy to redirect once it leaves your hands.',
  },
  {
    Icon: Search,
    title: 'Requests that turn out to be scams',
    desc: 'Fake invoices and fraudulent payees are hard to spot before the money is gone.',
  },
  {
    Icon: HelpCircle,
    title: 'No proof of where it went',
    desc: 'Without a public record, disputes are hard to resolve and trust is hard to rebuild.',
  },
]

export default function LandingProblem() {
  return (
    <section className="py-16 md:py-20" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[1040px] px-4">
        <h2
          className="display mb-10 text-center text-2xl font-semibold text-[var(--ink)] text-balance"
          style={{ letterSpacing: '-0.02em' }}
        >
          Money sent for a reason often ends up somewhere else.
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {PROBLEMS.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card group"
            >
              <div className="mb-3 inline-flex items-center justify-center rounded-lg bg-[#FDECEC] p-2.5 transition-transform duration-150 group-hover:-translate-y-0.5">
                <Icon className="size-5 text-[var(--danger)]" aria-hidden />
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
