/** Section 10 — Final CTA band */
import { ArrowRight } from 'lucide-react'
import { PRIVY_ENABLED } from '@/lib/privy'

interface Props {
  onSend: () => void
}

const CTA_BG_DEFAULT = 'var(--on-band)'
const CTA_BG_HOVER_LIGHT = '#E8F3F0'
const CTA_BG_HOVER_DARK = '#DDEFEA'

function ctaHoverBg(): string {
  if (typeof document === 'undefined') return CTA_BG_HOVER_LIGHT
  return document.documentElement.dataset['theme'] === 'dark' ||
    (document.documentElement.dataset['theme'] !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
    ? CTA_BG_HOVER_DARK
    : CTA_BG_HOVER_LIGHT
}

function CtaButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-input px-6 py-3 text-sm font-semibold shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--on-band)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--band)]"
      style={{ background: CTA_BG_DEFAULT, color: 'var(--band)' }}
      onMouseEnter={e => { e.currentTarget.style.background = ctaHoverBg() }}
      onMouseLeave={e => { e.currentTarget.style.background = CTA_BG_DEFAULT }}
    >
      Create a pot
      <ArrowRight className="size-4" aria-hidden style={{ color: 'var(--band)' }} />
    </button>
  )
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
          <CtaButton onClick={onSend} />
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
