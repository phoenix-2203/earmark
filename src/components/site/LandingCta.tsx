/** Section 10 — Final CTA band */
import { ArrowRight } from 'lucide-react'
import { PRIVY_ENABLED } from '@/lib/privy'

interface Props {
  onSend: () => void
}

function scrollFaq() {
  document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function LandingCta({ onSend }: Props) {
  return (
    <section className="py-20 md:py-24" style={{ background: 'var(--band)' }}>
      <div className="mx-auto max-w-[1040px] px-4 text-center">
        <h2
          className="display mb-4 text-3xl font-semibold text-balance"
          style={{ color: 'var(--on-band)', letterSpacing: '-0.02em' }}
        >
          Give money a purpose.
        </h2>
        <p className="mb-8 text-base text-pretty max-w-md mx-auto" style={{ color: 'var(--on-band)', opacity: 0.85 }}>
          {PRIVY_ENABLED
            ? 'Create your first pot in under two minutes. Sign in with Google or email, or connect a wallet.'
            : 'Create your first pot in under two minutes. No sign-up — just a wallet with USDC on Arc.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onSend}
            className="flex items-center gap-2 rounded-input bg-[var(--surface)] px-6 py-3 text-sm font-semibold shadow hover:bg-[var(--surface-2)] focus-visible:outline-2 transition-colors"
            style={{ color: 'var(--band)' }}
          >
            Create a pot
            <ArrowRight className="size-4" aria-hidden />
          </button>
          <button
            onClick={scrollFaq}
            className="text-sm font-medium focus-visible:outline-2 rounded px-2 underline-offset-2 hover:underline transition-colors"
            style={{ color: 'var(--on-band)', opacity: 0.85 }}
            onMouseEnter={e => ((e.currentTarget).style.opacity = '1')}
            onMouseLeave={e => ((e.currentTarget).style.opacity = '0.85')}
          >
            Read the FAQ
          </button>
        </div>
      </div>
    </section>
  )
}
