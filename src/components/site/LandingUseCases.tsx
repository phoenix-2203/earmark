/** Section 5 — Use cases */
import { Home, Users, Award, Briefcase } from 'lucide-react'

const CASES = [
  {
    Icon: Home,
    title: 'Money sent home',
    examples: ['School fees paid straight to the school', 'Rent paid straight to the landlord', 'Medical bills paid straight to the clinic'],
    badge: 'Remittances',
  },
  {
    Icon: Users,
    title: 'Staff allowances and per diems',
    examples: ['Field staff paid only to approved vendors', 'Travel expenses capped by purpose', 'Per diem to specific suppliers'],
    badge: 'Teams',
  },
  {
    Icon: Award,
    title: 'Grants and scholarships',
    examples: ['Tuition paid directly to the institution', 'Research budget for approved suppliers', 'Fellowship paid to approved services'],
    badge: 'Grants',
  },
  {
    Icon: Briefcase,
    title: 'Supplier and project budgets',
    examples: ['Project budget for specific contractors', 'Retainer paid month by month', 'Budget that returns unspent funds'],
    badge: 'Business',
  },
]

export default function LandingUseCases() {
  return (
    <section id="use-cases" className="py-16 md:py-20 bg-white scroll-mt-16">
      <div className="mx-auto max-w-[1040px] px-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Use cases
        </p>
        <h2
          className="display mb-10 text-center text-2xl font-semibold text-[var(--ink)] text-balance"
          style={{ letterSpacing: '-0.02em' }}
        >
          Wherever money needs a purpose.
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {CASES.map(({ Icon, title, examples, badge }) => (
            <div
              key={title}
              className="group rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex items-center justify-center rounded-lg bg-[var(--accent-soft)] p-2 transition-transform duration-150 group-hover:-translate-y-0.5">
                  <Icon className="size-5 text-[var(--accent)] group-hover:text-[var(--accent-hover)] transition-colors duration-150" aria-hidden />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
                  <span className="inline-block mt-0.5 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                    {badge}
                  </span>
                </div>
              </div>
              <ul className="space-y-1.5">
                {examples.map((ex) => (
                  <li key={ex} className="flex items-start gap-2 text-sm text-[var(--ink-2)]">
                    <span className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden>→</span>
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
