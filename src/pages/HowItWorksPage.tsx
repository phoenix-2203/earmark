import { ArrowLeft, GraduationCap, CheckCircle2, ReceiptText, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  onBack: () => void
}

const STEPS = [
  {
    n: 1,
    Icon: GraduationCap,
    title: 'Create a pot for one expense',
    body: `A pot is money set aside for a single purpose — school fees, rent, medical bills, or anything else. You set the title, category, and the amount you want to fund. You also set an end date: if there is money left after that date, you can take it back. You pick at least one approved payee (a school, landlord, or clinic) when you create the pot. Your family member can ask you to add more later.`,
  },
  {
    n: 2,
    Icon: CheckCircle2,
    title: 'Approve who can be paid',
    body: `Only the wallet addresses you approve can receive money from the pot. Your family member can request a new payee at any time — you will see the request and can approve or reject it. Earmark cannot verify who owns an address. It is your responsibility to confirm the address belongs to the school, landlord, or clinic before approving it. Get the address directly from the institution, not from a third party.`,
  },
  {
    n: 3,
    Icon: ReceiptText,
    title: 'Family pays, everyone can verify',
    body: `Your family member signs a transaction from their wallet to pay an approved payee. They can add a memo (e.g. "Term 1 fees, invoice 0042"). The payment goes directly from the pot to the payee's wallet — Earmark does not hold the money in between. Every payment is stored permanently on Arc with a receipt. Anyone with the link can verify the receipt.`,
  },
]

const GLOSSARY = [
  { term: 'Pot', def: 'Money set aside for one purpose. Created by the sender, managed on-chain.' },
  { term: 'Sender', def: 'The person who creates and funds the pot. Only the sender can approve payees, add funds, or extend the end date.' },
  { term: 'Family member', def: 'The person the pot is for. They can pay approved payees and request new ones.' },
  { term: 'Approved payee', def: 'A school, landlord, clinic, or other organisation that the pot is allowed to pay.' },
  { term: 'End date', def: 'The date after which no more payments can be made. The sender can reclaim unspent money after this date.' },
  { term: 'Receipt', def: 'An on-chain record of a payment: who paid, how much, to whom, and a memo. Public and permanent.' },
]

const FAQS = [
  {
    q: 'What is a pot?',
    a: 'A pot is USDC you set aside for a specific purpose. The contract ensures that money can only be paid to the addresses you approved. Think of it as a ring-fenced budget for one expense.',
  },
  {
    q: 'Who can be paid from a pot?',
    a: 'Only the wallet addresses you explicitly approved when creating the pot, or added later. Your family member can request a new payee, but you must approve it before any payment can go there.',
  },
  {
    q: 'What if my family needs to pay someone new?',
    a: 'Your family member can tap "Ask to add a payee" in the pot. They enter the address, a label, and a reason. You will see the request and can approve or reject it. Once approved, the new payee can receive payments.',
  },
  {
    q: 'What happens to unspent money?',
    a: 'After the end date, you can take back any unspent money ("Take back unspent money"). You can also give the whole remaining balance to your family member at any time ("Give the rest to family") — this closes the pot.',
  },
  {
    q: 'What does the receipt prove?',
    a: 'The receipt proves that a specific amount of USDC was transferred from the pot to an approved payee address, at a specific time, with a memo. It does not prove what goods or services were delivered in exchange.',
  },
]

export default function HowItWorksPage({ onBack }: Props) {
  return (
    <main className="mx-auto max-w-content px-4 pb-32 pt-6 md:pb-16">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back
      </button>

      <h1 className="display mb-8 text-3xl font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.02em' }}>
        How Earmark works
      </h1>

      {/* Steps */}
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

      {/* What Earmark enforces */}
      <section className="mb-12 rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card" aria-labelledby="enforces-h">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-5 text-[var(--accent)]" aria-hidden />
          <h2 id="enforces-h" className="text-sm font-semibold text-[var(--ink)]">What the contract enforces</h2>
        </div>
        <p className="mb-3 text-sm text-[var(--ink-2)] text-pretty leading-relaxed">
          The Earmark contract only lets a pot pay addresses the sender approved. It does not verify who
          owns those addresses — that is the sender's responsibility. The contract also cannot reverse a
          confirmed payment, and it cannot work with tokens other than USDC.
        </p>
        <p className="text-xs text-[var(--muted)]">
          Earmark is experimental and has not been professionally audited. Use small amounts.
        </p>
      </section>

      {/* Glossary */}
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

      {/* FAQs */}
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
  )
}
