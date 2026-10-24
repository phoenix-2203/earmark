/** Section 9 — FAQ accordion using <details>/<summary> */
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: 'What is a pot?',
    a: "A pot is a fixed amount of USDC set aside for one specific purpose — for example, a contractor's materials budget for one project, or a grant for one research programme. Money in a pot can only be spent at the approved payees the funder chose; any unspent balance returns to the funder after the end date.",
  },
  {
    q: 'Who can the recipient pay?',
    a: 'Only the addresses the funder has added to the approved payee list. The contract blocks any payment to any other address, including the recipient\'s own wallet. Approved payees are addresses of specific organisations or people — a school, a clinic, a landlord, or a supplier.',
  },
  {
    q: 'What if the recipient needs to pay someone new?',
    a: 'The recipient can submit a payee request from the pot page, including the address, a label, and a reason. The funder reviews and approves or rejects it. Only after funder approval can the recipient pay that address.',
  },
  {
    q: 'Can the recipient withdraw the money?',
    a: 'No — the recipient can only pay approved payees directly from the pot. They cannot transfer the balance to their own wallet. If the funder wants to give the remaining balance to the recipient, the funder can use "Release the rest to recipient" — this sends all remaining funds directly to the recipient\'s wallet.',
  },
  {
    q: 'What happens to unspent money?',
    a: 'After the end date the funder can call "Take back unspent money" to reclaim the remaining balance. Alternatively, the funder can use "Release the rest to recipient" at any time to send the balance to the recipient.',
  },
  {
    q: 'How do I know a payee is real?',
    a: 'Two ways. 1) Businesses with their own website add one line to their domain settings: earmark=0xTheirWallet — Earmark shows "Verified by theirdomain.com". Free addresses like *.duckdns.org or *.github.io don\'t count. 2) Anyone else: tap "Ask payee to confirm" and send the link using contact details you found yourself. They tap Confirm in their wallet (free) and send the link back. Never use contact details from the person asking you to add the payee.',
  },
  {
    q: 'What does a receipt prove?',
    a: 'A receipt proves that a specific amount of USDC was sent from a specific pot to a specific payee address on a specific date, recorded on Arc. It does not prove who owns those addresses in the real world — you need to verify that separately.',
  },
  {
    q: 'Does Earmark hold my money or charge fees?',
    a: 'No. When you create a pot, the USDC is transferred directly into the Earmark smart contract — there is no company holding it. The contract has no owner, no admin key, and takes no fees. You pay only the Arc network gas (also in USDC, typically a fraction of a cent).',
  },
  {
    q: 'Do I need crypto experience?',
    a: 'No. Sign in with Google or your email and Earmark creates a wallet for you. You can also connect your own wallet.',
  },
  {
    q: 'Can I pay someone who isn\'t on Earmark yet?',
    a: 'Yes — type their email. Earmark creates their wallet; only whoever controls that inbox can sign in and use the money.',
  },
]

export default function LandingFaq() {
  return (
    <section id="faq" className="py-16 md:py-20 bg-white scroll-mt-16">
      <div className="mx-auto max-w-[1040px] px-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          FAQ
        </p>
        <h2
          className="display mb-10 text-center text-2xl font-semibold text-[var(--ink)] text-balance"
          style={{ letterSpacing: '-0.02em' }}
        >
          Common questions.
        </h2>

        <div className="mx-auto max-w-2xl divide-y divide-[var(--line)] rounded-card border border-[var(--line)] overflow-hidden shadow-card">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              className="group bg-[var(--surface)] open:bg-[var(--accent-soft)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] group-open:hover:bg-[var(--accent-soft)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded">
                {q}
                <ChevronDown
                  className="size-4 shrink-0 text-[var(--muted)] transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="px-5 pb-5 pt-1">
                <p className="text-sm text-[var(--ink-2)] leading-relaxed">{a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
