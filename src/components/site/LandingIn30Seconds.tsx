/**
 * "Earmark in 30 seconds" landing section.
 * Left column: 3 paragraphs + analogy card.
 * Right column (desktop): nothing — FlowScene runs full-width BELOW the two columns.
 */
import { CreditCard, GraduationCap, BookOpen, User } from 'lucide-react'
import FlowScene, { type SceneParty } from '@/components/site/FlowScene'

const SCENE_FUNDER:    SceneParty = { label: 'You',              Icon: CreditCard     }
const SCENE_RECIPIENT: SceneParty = { label: 'Your brother',     Icon: User           }
const SCENE_PAYEES: [SceneParty, SceneParty] = [
  { label: 'Greenfield School', Icon: GraduationCap },
  { label: 'City Bookshop',     Icon: BookOpen       },
]

export default function LandingIn30Seconds() {
  return (
    <section
      id="in-30-seconds"
      className="border-b border-[var(--line)] bg-[var(--surface)]"
      aria-labelledby="in30-heading"
    >
      <div className="mx-auto max-w-[1040px] px-4 py-16 sm:py-20">
        <h2
          id="in30-heading"
          className="mb-10 text-2xl font-semibold text-[var(--ink)] sm:text-3xl"
          style={{ letterSpacing: '-0.02em' }}
        >
          Earmark in 30 seconds
        </h2>

        {/* ── Two columns: story + analogy ── */}
        <div className="mb-10 grid gap-10 lg:grid-cols-2 lg:items-start">

          {/* Left: story */}
          <div className="space-y-5">
            <p className="text-base leading-relaxed text-[var(--ink-2)]">
              You send your brother{' '}
              <strong className="font-semibold text-[var(--ink)]">500 USDC for school fees</strong>.
              With a normal transfer, the money is his — it can be spent on anything, and you have no proof where it went.
            </p>
            <p className="text-base leading-relaxed text-[var(--ink-2)]">
              With Earmark, you put the 500 USDC in a pot called{' '}
              <em>"School fees · Term 1"</em> and approve{' '}
              <strong className="font-semibold text-[var(--ink)]">Greenfield School</strong> and{' '}
              <strong className="font-semibold text-[var(--ink)]">City Bookshop</strong>.
              Your brother still decides when and how much to pay — but the contract will only send money to those two.
              If he tries to pay himself or anyone else, it's blocked.
            </p>
            <p className="text-base leading-relaxed text-[var(--ink-2)]">
              Every payment leaves a{' '}
              <strong className="font-semibold text-[var(--ink)]">public receipt</strong>{' '}
              anyone can check. Money left after the end date comes back to you.
            </p>
          </div>

          {/* Right: analogy card */}
          <div className="flex items-start">
            <div
              className="flex gap-4 rounded-card border-2 p-5"
              style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}
            >
              <CreditCard className="mt-0.5 size-6 shrink-0 text-[var(--accent)]" aria-hidden />
              <p className="text-sm leading-relaxed text-[var(--ink-2)]">
                <strong className="font-semibold text-[var(--ink)]">Like a prepaid card</strong>{' '}
                that only works at the shops you chose — and every swipe is visible to both of you.
              </p>
            </div>
          </div>
        </div>

        {/* ── FlowScene: full width below both columns ── */}
        <FlowScene
          funder={SCENE_FUNDER}
          recipient={SCENE_RECIPIENT}
          payees={SCENE_PAYEES}
          blocked="Your brother's own wallet"
          potTitle="School fees · Term 1"
          amountNum={500}
          currency="USDC"
        />
      </div>
    </section>
  )
}
