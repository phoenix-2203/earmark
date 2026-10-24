/**
 * About page — #/about
 * What Earmark is, who it's for, how it was built, and the roadmap.
 */
import SiteHeader from '@/components/site/SiteHeader'
import SiteFooter from '@/components/site/SiteFooter'
import { Home, Users, Award, Briefcase, Github, ExternalLink } from 'lucide-react'
import { EARMARK_CHAIN, EARMARK_ADDRESS, EARMARK_CHAIN_ID } from '@/earmarkConfig'

interface Props {
  onSend: () => void
  onSent: () => void
  onReceived: () => void
  onHow: () => void
  onBack: () => void
}

const USE_CASES = [
  { Icon: Briefcase,title: 'Supplier and project budgets', desc: 'A project budget that can only be spent at the approved suppliers, with unspent funds returning to the funder.' },
  { Icon: Users,    title: 'Staff allowances and per diems', desc: 'Field teams spend only at approved vendors; managers see a verifiable record of every payment.' },
  { Icon: Award,    title: 'Grants and scholarships',      desc: 'Disbursements tied to specific recipients and institutions, with a public audit trail.' },
  { Icon: Home,     title: 'Money sent home',             desc: 'School fees, rent, and medical bills paid directly to the institution — not to an intermediary.' },
]

const ROADMAP = [
  {
    title: 'Fee sponsorship so new users need no USDC for fees',
    desc: 'New users will be able to accept payments and pay approved payees with 0 USDC in their wallet — gas covered on their behalf.',
  },
  {
    title: 'Shareable recipient IDs',
    desc: 'A human-readable ID or link that funders can use to create a pot for someone without asking for their raw wallet address.',
  },
  {
    title: 'Top-ups straight from exchanges',
    desc: 'Fund a pot directly from a centralised exchange account without needing to move USDC manually first.',
  },
  {
    title: 'Local-currency cash-out partners',
    desc: 'Payees in certain markets will be able to convert USDC receipts into local currency through integrated cash-out partners.',
  },
]

export default function AboutPage({ onSend, onSent, onReceived, onHow, onBack }: Props) {
  const explorerUrl = `${EARMARK_CHAIN.explorerBase}/address/${EARMARK_ADDRESS}`

  return (
    <>
      <SiteHeader onOpenApp={onSend} onHow={onHow} onAbout={onBack} />
      <main className="pb-16">

        {/* ── Hero ── */}
        <section className="bg-white py-14 md:py-20 border-b border-[var(--line)]">
          <div className="mx-auto max-w-[720px] px-4 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">About Earmark</p>
            <h1
              className="display mb-4 text-3xl font-semibold text-[var(--ink)] text-balance"
              style={{ letterSpacing: '-0.025em' }}
            >
              Money that can only go where it's meant to go.
            </h1>
            <p className="text-base text-[var(--ink-2)] leading-relaxed text-pretty max-w-prose mx-auto">
              Earmark is a smart contract on Arc that lets you put money aside for one specific purpose
              and enforce — at the contract level — that it can only be spent at the exact addresses you approve.
              No trust required. No intermediary. Every payment leaves a public receipt.
            </p>
          </div>
        </section>

        {/* ── Why it exists ── */}
        <section className="py-14" style={{ background: 'var(--bg)' }}>
          <div className="mx-auto max-w-[720px] px-4">
            <h2 className="display mb-4 text-xl font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.02em' }}>
              Why it exists
            </h2>
            <div className="space-y-4 text-sm text-[var(--ink-2)] leading-relaxed">
              <p>
                When you send money to someone and ask them to spend it on something specific — school fees,
                rent, a medical bill — you have to trust they will. Most of the time they do. But trust is
                fragile: requests get confused, intentions change, and there is rarely any proof of what happened.
              </p>
              <p>
                Earmark replaces that trust requirement with a contract. The USDC goes straight into a
                pot on Arc. The pot has a list of approved payees — the exact addresses of the school, clinic,
                landlord, or supplier. The recipient can only spend from the pot to those addresses.
                Nothing else. The contract enforces it, not a person.
              </p>
              <p>
                Every payment from a pot is recorded on Arc's public ledger. Anyone with the receipt link
                can verify it — no wallet, no account, no login needed.
              </p>
            </div>
          </div>
        </section>

        {/* ── Who it's for ── */}
        <section className="py-14 bg-white">
          <div className="mx-auto max-w-[1040px] px-4">
            <h2 className="display mb-8 text-xl font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.02em' }}>
              Who it's for
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {USE_CASES.map(({ Icon, title, desc }) => (
                <div key={title} className="flex gap-4 rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card">
                  <div className="flex items-center justify-center rounded-lg bg-[var(--accent-soft)] p-2.5 h-fit">
                    <Icon className="size-5 text-[var(--accent)]" aria-hidden />
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-[var(--ink)]">{title}</h3>
                    <p className="text-sm text-[var(--ink-2)] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it was built ── */}
        <section className="py-14" style={{ background: 'var(--bg)' }}>
          <div className="mx-auto max-w-[720px] px-4">
            <h2 className="display mb-4 text-xl font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.02em' }}>
              How it was built
            </h2>
            <div className="space-y-4 text-sm text-[var(--ink-2)] leading-relaxed">
              <p>
                Earmark was designed and built entirely with{' '}
                <a href="https://studio.arc.io" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded">
                  Arc Studio
                </a>
                {' '}— Circle's onchain app builder. The Solidity contract, its 61 unit tests,
                the deployment scripts, and this application were all produced through Arc Studio
                and deployed on{' '}
                <a
                  href={`${EARMARK_CHAIN.explorerBase}/address/${EARMARK_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
                >
                  {EARMARK_CHAIN_ID === 5042 ? 'Arc mainnet' : 'Arc Testnet'}
                </a>
                .
              </p>
              <p>
                The contract has no owner, no admin key, no upgrade proxy, and no fee mechanism.
                It is a pure escrow: USDC in, payments out to approved addresses only.
                It was not independently audited — treat it as experimental and use small amounts.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors shadow-card"
              >
                <ExternalLink className="size-4" aria-hidden />
                Contract on explorer
              </a>
              <a
                href="https://github.com/phoenix-2203/earmark"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors shadow-card"
              >
                <Github className="size-4" aria-hidden />
                Source on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* ── What we store ── */}
        <section className="py-14" style={{ background: 'var(--bg)' }}>
          <div className="mx-auto max-w-[720px] px-4">
            <h2 className="display mb-4 text-xl font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.02em' }}>
              What we store
            </h2>
            <div className="space-y-3 text-sm text-[var(--ink-2)] leading-relaxed">
              <p>
                Earmark stores nothing itself. All pot data — recipients, payees, payments — is written directly to the Arc smart contract and is public and permanent on-chain.
              </p>
              <p>
                Sign-in and embedded wallets are provided by{' '}
                <a href="https://privy.io" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded">Privy</a>.
                {' '}Privy stores the association between your email/Google account and your wallet. Earmark does not have access to your private key; Privy manages it on your behalf.
              </p>
              <p>
                The Earmark API only looks up or creates the wallet for an email you type when adding a payee — no emails or names are stored server-side after the response.
              </p>
            </div>
          </div>
        </section>

        {/* ── Roadmap ── */}
        <section id="roadmap" className="py-14 bg-white scroll-mt-16">
          <div className="mx-auto max-w-[720px] px-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="display text-xl font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.02em' }}>
                Roadmap
              </h2>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">Planned</span>
            </div>
            <p className="mb-6 text-sm text-[var(--muted)]">
              These features are planned but not yet built. Nothing below is available today.
            </p>
            <ol className="space-y-4">
              {ROADMAP.map(({ title, desc }, i) => (
                <li key={i} className="flex gap-4 rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5"
                    style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-[var(--ink)]">{title}</h3>
                    <p className="text-sm text-[var(--ink-2)] leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

      </main>
      <SiteFooter
        onSend={onSend}
        onSent={onSent}
        onReceived={onReceived}
        onHow={onHow}
        onAbout={onBack}
      />
    </>
  )
}
