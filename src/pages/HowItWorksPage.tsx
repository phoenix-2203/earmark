import { ArrowLeft, GraduationCap, CheckCircle2, ReceiptText, ShieldCheck, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import SiteHeader from '@/components/site/SiteHeader'
import SiteFooter from '@/components/site/SiteFooter'
import FlowScene from '@/components/site/FlowScene'
import { Plane, Hospital, Home } from 'lucide-react'

interface Props {
  onBack: () => void
  onSend?: () => void
  onAbout?: () => void
}

const STEPS = [
  {
    n: 1,
    Icon: GraduationCap,
    title: 'Create a pot for one expense',
    body: `A pot is USDC set aside for a single purpose — school fees, rent, a medical bill, a supplier invoice, or anything else. The funder sets the title, category, and amount, then picks an end date: if money is left after that date, the funder can take it back. At least one approved payee (a school, supplier, clinic, or landlord) must be added when creating the pot. The recipient can ask the funder to add more later.`,
  },
  {
    n: 2,
    Icon: CheckCircle2,
    title: 'Approve who can be paid',
    body: `Only the wallet addresses the funder approves can receive money from the pot. The recipient can request a new payee at any time — the funder will see the request and can approve or reject it. Earmark cannot verify who owns an address. It is the funder's responsibility to confirm the address belongs to the intended payee. Get the address directly from the institution or individual, not from a third party.`,
  },
  {
    n: 3,
    Icon: ReceiptText,
    title: 'The recipient pays; anyone can verify',
    body: `The recipient signs a transaction from their wallet to pay an approved payee. They can add a memo (e.g. "Term 1 fees, invoice 0042"). The payment goes directly from the pot to the payee's wallet — Earmark does not hold the money in between. Every payment is stored permanently on Arc with a receipt. Anyone with the link can verify the receipt.`,
  },
]

const USE_CASES = [
  {
    title: 'Money sent home',
    examples: ['School fees, rent, medical bills', 'Recurring household expenses', 'Emergency funds with guardrails'],
  },
  {
    title: 'Allowances and per diems',
    examples: ['Staff travel budgets', 'Field expense accounts', 'Project-specific petty cash'],
  },
  {
    title: 'Grants and scholarships',
    examples: ['Tuition grants paid directly to institutions', 'Research budgets with approved suppliers', 'Disbursements to specific service providers'],
  },
  {
    title: 'Supplier and project budgets',
    examples: ['Contractor payments tied to a project', 'Procurement budgets with approved vendors', 'Milestone-gated payments'],
  },
]

const GLOSSARY = [
  { term: 'Pot', def: 'USDC set aside for one purpose. Created and funded by the funder, managed on-chain.' },
  { term: 'Funder', def: 'The person who creates and funds the pot. Only the funder can approve payees, add funds, or extend the end date.' },
  { term: 'Recipient', def: 'The person the pot is for. They can pay approved payees and request new ones.' },
  { term: 'Approved payee', def: 'A school, supplier, clinic, landlord, or other party that the pot is allowed to pay. Must be approved by the funder before any payment can go there.' },
  { term: 'End date', def: 'The date after which no more payments can be made. The funder can reclaim unspent money after this date.' },
  { term: 'Receipt', def: 'An on-chain record of a payment: who paid, how much, to whom, and a memo. Public and permanent.' },
]

const FAQS = [
  {
    q: 'What is a pot?',
    a: 'A pot is USDC you set aside for a specific purpose. The contract ensures that money can only be paid to the addresses the funder approved. Think of it as a ring-fenced budget for one expense.',
  },
  {
    q: 'Who can be paid from a pot?',
    a: 'Only the wallet addresses the funder explicitly approved when creating the pot, or added later. The recipient can request a new payee, but the funder must approve it before any payment can go there.',
  },
  {
    q: 'What if the recipient needs to pay someone new?',
    a: 'The recipient can tap "Ask to add a payee" in the pot. They enter the address, a label, and a reason. The funder will see the request and can approve or reject it. Once approved, the new payee can receive payments.',
  },
  {
    q: 'What happens to unspent money?',
    a: 'After the end date, the funder can take back any unspent money ("Take back unspent money"). The funder can also release the whole remaining balance to the recipient at any time ("Release the rest to recipient") — this closes the pot.',
  },
  {
    q: 'What does the receipt prove?',
    a: 'The receipt proves that a specific amount of USDC was transferred from the pot to an approved payee address, at a specific time, with a memo. It does not prove what goods or services were delivered in exchange.',
  },
  {
    q: 'Can the funder or recipient be an approved payee?',
    a: 'No. The contract prevents both the funder and the recipient from being approved payees. This is what keeps the money tied to its purpose — it can only flow to outside parties.',
  },
]

// Roles table data
const ROLES = [
  {
    role: 'Funder',
    can: 'Create and fund pots, add or remove payees, approve or reject payee requests, top up, extend the end date, release the rest, take back unspent money after the end date',
    cannot: 'Be a payee of their own pot',
  },
  {
    role: 'Recipient',
    can: 'Pay approved payees, request new payees',
    cannot: 'Pay themselves, pay anyone not approved, or withdraw the money directly',
  },
  {
    role: 'Approved payee',
    can: 'Receive payments',
    cannot: 'Initiate anything; no account needed, just a wallet address',
  },
]

const SCENE_FUNDER    = { label: 'You, abroad',       Icon: Plane       }
const SCENE_RECIPIENT = { label: 'Your family',        Icon: Home        }
const SCENE_PAYEES: [typeof SCENE_FUNDER, typeof SCENE_FUNDER] = [
  { label: 'The school',   Icon: GraduationCap },
  { label: 'The hospital', Icon: Hospital       },
]

export default function HowItWorksPage({ onBack, onSend, onAbout }: Props) {
  const handleSend  = onSend  ?? onBack
  const handleAbout = onAbout ?? onBack
  return (
    <>
      <SiteHeader onOpenApp={handleSend} onHow={onBack} onAbout={handleAbout} />
      <main className="mx-auto max-w-content px-4 pb-16 pt-6">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </button>

        <h1 className="display mb-8 text-3xl font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.02em' }}>
          How Earmark works
        </h1>

        {/* ── Static diagram ── */}
        <section className="mb-10" aria-labelledby="diagram-h">
          <h2 id="diagram-h" className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Overview diagram</h2>
          <div className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card overflow-hidden">
            <img
              src="/how-earmark-works.svg"
              alt="Diagram: the funder locks USDC in a pot; the recipient can pay only approved payees; payments to anyone else are blocked; every payment leaves a public receipt; unspent money returns to the funder."
              className="w-full"
              loading="lazy"
            />
            <p className="mt-3 text-right md:hidden">
              <a
                href="/how-earmark-works.svg"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
              >
                Open diagram full size <ExternalLink className="size-3" aria-hidden />
              </a>
            </p>
          </div>
        </section>

        {/* ── Animated scene ── */}
        <section className="mb-10" aria-labelledby="scene-h">
          <h2 id="scene-h" className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Interactive illustration</h2>
          <FlowScene
            funder={SCENE_FUNDER}
            recipient={SCENE_RECIPIENT}
            payees={SCENE_PAYEES}
            blocked="Family's own wallet"
            potTitle="School fees · Term 1"
            amount="500 USDC"
          />
        </section>

        {/* ── Steps ── */}
        <section className="mb-12 space-y-6" aria-labelledby="steps-h">
          <h2 id="steps-h" className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">The three steps</h2>
          <ol className="space-y-5">
            {STEPS.map(({ n, Icon, title, body }) => (
              <li key={n} className="flex gap-4 rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card">
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  {n}
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="size-4 text-[var(--accent)]" aria-hidden />
                    <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
                  </div>
                  <p className="text-sm text-[var(--ink-2)] text-pretty leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Roles table ── */}
        <section className="mb-12" aria-labelledby="roles-h">
          <h2 id="roles-h" className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Roles</h2>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-card border border-[var(--line)] shadow-card">
            <table className="w-full border-collapse text-sm" aria-label="Roles: what each party can and cannot do">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg)]">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Role</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Can</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Can't</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map(({ role, can, cannot }) => (
                  <tr key={role} className="border-t border-[var(--line)] bg-[var(--surface)]">
                    <td className="px-4 py-3 font-semibold text-[var(--ink)]">{role}</td>
                    <td className="px-4 py-3 text-[var(--ink-2)]">{can}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{cannot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {ROLES.map(({ role, can, cannot }) => (
              <div key={role} className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card">
                <p className="mb-2 font-semibold text-[var(--ink)]">{role}</p>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Can</p>
                <p className="mb-2 text-sm text-[var(--ink-2)]">{can}</p>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Can't</p>
                <p className="text-sm text-[var(--muted)]">{cannot}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Use cases ── */}
        <section className="mb-12" aria-labelledby="uses-h">
          <h2 id="uses-h" className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Use cases</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {USE_CASES.map(({ title, examples }) => (
              <div key={title} className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card">
                <p className="mb-2 text-sm font-semibold text-[var(--ink)]">{title}</p>
                <ul className="space-y-1">
                  {examples.map((ex) => (
                    <li key={ex} className="flex items-start gap-1.5 text-xs text-[var(--ink-2)]">
                      <span className="mt-0.5 text-[var(--accent)]" aria-hidden>·</span>
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── What Earmark enforces ── */}
        <section className="mb-12 rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card" aria-labelledby="enforces-h">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="size-5 text-[var(--accent)]" aria-hidden />
            <h2 id="enforces-h" className="text-sm font-semibold text-[var(--ink)]">What the contract enforces</h2>
          </div>
          <p className="mb-3 text-sm text-[var(--ink-2)] text-pretty leading-relaxed">
            The Earmark contract only lets a pot pay addresses the funder approved. It does not verify who
            owns those addresses — that is the funder's responsibility. The contract also cannot reverse a
            confirmed payment, and it cannot work with tokens other than USDC.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Earmark is experimental and has not been professionally audited. Use small amounts.
          </p>
        </section>

        {/* ── Glossary ── */}
        <section className="mb-12" aria-labelledby="glossary-h">
          <h2 id="glossary-h" className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Glossary</h2>
          <dl className="space-y-3">
            {GLOSSARY.map(({ term, def }) => (
              <div key={term} className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card">
                <dt className="text-sm font-semibold text-[var(--ink)]">{term}</dt>
                <dd className="mt-0.5 text-sm text-[var(--ink-2)] text-pretty">{def}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── FAQs ── */}
        <section aria-labelledby="faq-h">
          <h2 id="faq-h" className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Frequently asked questions</h2>
          <dl className="space-y-3">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card">
                <dt className="text-sm font-semibold text-[var(--ink)]">{q}</dt>
                <dd className="mt-1 text-sm text-[var(--ink-2)] text-pretty leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-10">
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden />
            Back to home
          </Button>
        </div>
      </main>
      <SiteFooter
        onSend={handleSend}
        onSent={onBack}
        onReceived={onBack}
        onHow={onBack}
        onAbout={handleAbout}
      />
    </>
  )
}
