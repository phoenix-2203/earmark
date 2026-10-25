/**
 * Landing Hero — single centered column.
 * H1 · subtitle · two buttons · trust line. ≤520px tall on desktop.
 * The interactive FlowScene lives in "Earmark in 30 seconds" directly below.
 */
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PRIVY_ENABLED } from '@/lib/privy'

interface Props {
  onSend: () => void
}

export default function LandingHero({ onSend }: Props) {
  function scrollHow() {
    document.getElementById('in-30-seconds')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="bg-[var(--surface)] py-20 md:py-24 lg:py-28">
      <div className="mx-auto max-w-[640px] px-4 text-center">
        <h1
          className="display mb-5 font-semibold text-[var(--ink)] text-balance leading-tight"
          style={{ letterSpacing: '-0.025em', fontSize: 'clamp(2rem,5vw,3.25rem)' }}
        >
          Money with a purpose.
        </h1>
        <p className="text-lg text-[var(--ink-2)] leading-relaxed text-pretty mb-8 max-w-prose mx-auto">
          Fund a pot in USDC for one expense. The recipient can only pay
          the payees you approve — and every payment leaves a public
          receipt on Arc.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center mb-7">
          <Button size="lg" onClick={onSend}>
            Create a pot
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <button
            onClick={scrollHow}
            className="text-sm font-medium text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded px-1"
          >
            See how it works
          </button>
        </div>

        {/* Trust line */}
        <p className="text-xs text-[var(--muted)] flex flex-wrap gap-x-4 gap-y-1 justify-center">
          {PRIVY_ENABLED && (
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[var(--success)] inline-block" aria-hidden />
              Sign in with Google
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[var(--accent)] inline-block" aria-hidden />
            Live on Arc
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[var(--muted)] inline-block" aria-hidden />
            No admin key
          </span>
        </p>
      </div>
    </section>
  )
}
