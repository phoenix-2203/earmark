/** Section 10 — Final CTA band */
import { ArrowRight } from 'lucide-react'

interface Props {
  onSend: () => void
}

function scrollFaq() {
  document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function LandingCta({ onSend }: Props) {
  return (
    <section className="py-20 md:py-24" style={{ background: 'var(--accent)' }}>
      <div className="mx-auto max-w-[1040px] px-4 text-center">
        <h2
          className="display mb-4 text-3xl font-semibold text-white text-balance"
          style={{ letterSpacing: '-0.02em' }}
        >
          Give money a purpose.
        </h2>
        <p className="mb-8 text-base text-white/80 text-pretty max-w-md mx-auto">
          Create your first pot in under two minutes. No sign-up — just a wallet with USDC on Arc.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onSend}
            className="flex items-center gap-2 rounded-input bg-white px-6 py-3 text-sm font-semibold text-[var(--accent)] shadow hover:bg-[var(--accent-soft)] focus-visible:outline-2 focus-visible:outline-white transition-colors"
          >
            Create a pot
            <ArrowRight className="size-4" aria-hidden />
          </button>
          <button
            onClick={scrollFaq}
            className="text-sm font-medium text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-white rounded px-2 underline-offset-2 hover:underline transition-colors"
          >
            Read the FAQ
          </button>
        </div>
      </div>
    </section>
  )
}
