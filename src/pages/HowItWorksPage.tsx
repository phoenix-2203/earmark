import { ArrowLeft, GraduationCap, CheckCircle2, ReceiptText, ExternalLink, ShieldCheck } from 'lucide-react'
import { PRIVY_ENABLED } from '@/lib/privy'
import { Button } from '@/components/ui/Button'
import SiteHeader from '@/components/site/SiteHeader'
import SiteFooter from '@/components/site/SiteFooter'
import FlowScene from '@/components/site/FlowScene'
import { Building2, Hammer, Zap } from 'lucide-react'

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
    body: `A pot is USDC set aside for a single purpose — for example a supplier or service provider, or a specific project or expense. The funder sets the title, category, and amount, then picks an end date: if money is left after that date, the funder can take it back. At least one approved payee must be added when creating the pot. The recipient can ask the funder to add more later.`,
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
    body: `The recipient signs a transaction from their wallet to pay an approved payee. They can add a memo (e.g. "PO-1042 · materials"). The payment goes directly from the pot to the payee's wallet — Earmark does not hold the money in between. Every payment is stored permanently on Arc with a receipt. Anyone with the link can verify the receipt.`,
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

// Roles table data
const ROLES = [
  {
    role: 'Funder',
    can: 'Create and fund pots, pay approved payees, add or remove payees, approve or reject payee requests, top up, extend the end date, release the rest, take back unspent money after the end date',
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

const SCENE_FUNDER    = { label: 'Your company',   Icon: Building2 }
const SCENE_RECIPIENT = { label: 'The contractor', Icon: Hammer    }
const SCENE_PAYEES: [typeof SCENE_FUNDER, typeof SCENE_FUNDER] = [
  { label: 'Halden Building Supplies', Icon: Hammer },
  { label: 'Brightline Electrical',    Icon: Zap    },
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
            blocked="Contractor's own wallet"
            potTitle="Office fit-out · Phase 1"
            amountNum={5000}
            currency="USDC"
          />
        </section>

        {/* ── Steps ── */}
        <section className="mb-12 space-y-6" aria-labelledby="steps-h">
          <h2 id="steps-h" className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Step by step</h2>
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

        {/* ── Verified payees ── */}
        <section className="mb-12" aria-labelledby="verified-payees-h">
          <h2 id="verified-payees-h" className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            <ShieldCheck className="size-4 text-[var(--success)]" aria-hidden /> Verified payees
          </h2>
          <p className="mb-4 text-sm text-[var(--ink-2)] text-pretty">
            Three ways to make sure a payee is real. None replaces contacting the payee through channels you found yourself.
          </p>
          <div className="space-y-3">
            <div className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card">
              <p className="text-sm font-semibold text-[var(--ink)] mb-2">1) Domain verification (businesses with their own website)</p>
              <p className="text-sm text-[var(--ink-2)] mb-2 text-pretty">
                Businesses add one line to their domain settings:{' '}
                <code className="font-mono text-xs bg-[var(--surface-2)] px-1 rounded">earmark=0xTheirWallet</code>{' '}
                — Earmark then shows "Verified by theirdomain.com".
              </p>
              <div className="rounded-input bg-[var(--surface-2)] px-4 py-3 font-mono text-xs text-[var(--ink)] break-all mb-2">
                earmark=0xTheirWalletAddress
              </div>
              <p className="text-xs text-[var(--muted)]">Add this as a TXT record on <code className="font-mono">_earmark.theirdomain.com</code> or the domain itself. Replace <code className="font-mono">0xTheirWalletAddress</code> with the full wallet address.</p>
              <p className="mt-2 text-xs text-[var(--warning)] font-medium">Free addresses like *.duckdns.org or *.github.io don't count — anyone can register those.</p>
            </div>
            <div className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card">
              <p className="text-sm font-semibold text-[var(--ink)] mb-2">2) Ask them directly (anyone with a wallet)</p>
              <p className="text-sm text-[var(--ink-2)] mb-2 text-pretty">
                Tap <strong>"Ask payee to confirm"</strong> and send the link using contact details you found yourself — their official phone number, email or website. They tap Confirm in their wallet (free, no money moves) and send the link back. You paste or open it; Earmark verifies the signature.
              </p>
              <p className="text-xs text-[var(--warning)] font-medium">
                Never use contact details from the person asking you to add the payee.
              </p>
            </div>
            {PRIVY_ENABLED && (
              <div className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card">
                <p className="text-sm font-semibold text-[var(--ink)] mb-2">3) Pay by email</p>
                <p className="text-sm text-[var(--ink-2)] mb-2 text-pretty">
                  Type the payee's email in any address field. Earmark creates a permanent wallet for that address; only whoever controls that inbox can sign in and use the money. Business addresses (e.g. <code className="font-mono text-xs">billing@example.com</code>) show a green badge; personal addresses (Gmail, Outlook…) show a caution badge — confirm it's really their email.
                </p>
                <p className="text-xs text-[var(--warning)] font-medium">Use a business or official email, not a personal one, where possible.</p>
              </div>
            )}
            <div className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card">
              <p className="text-sm font-semibold text-[var(--ink)] mb-1">What verification proves and what it doesn't</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--ink-2)]">
                <li><strong>Domain:</strong> the person controlling that domain linked this wallet address. Doesn't prove the domain belongs to the right company — confirm the domain separately.</li>
                <li><strong>Wallet confirmation:</strong> someone who controls the payee's private key signed your request. The funder's responsibility is ensuring they're contacting the right person.</li>
                {PRIVY_ENABLED && (
                  <li><strong>Email:</strong> only whoever controls that inbox can access the funds. Doesn't prove the email belongs to the intended payee — confirm separately.</li>
                )}
                <li>DNS records can change. The badge reflects the record at the time you check.</li>
              </ul>
            </div>
          </div>
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

        {/* ── More questions ── */}
        <p className="mb-10 text-sm text-[var(--ink-2)]">
          More questions?{' '}
          <a
            href="#/#faq"
            onClick={onBack}
            className="text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
          >
            See the FAQ on the home page.
          </a>
        </p>

        <div className="mt-2">
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
