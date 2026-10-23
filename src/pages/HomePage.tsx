/**
 * HomePage — the public landing page.
 * Order: Hero → In 30 seconds → Who it's for → How it's different →
 *        Try the rules → Live on Arc → Why Arc → Safety → FAQ → CTA
 */
import SiteHeader        from '@/components/site/SiteHeader'
import SiteFooter        from '@/components/site/SiteFooter'
import LandingHero       from '@/components/site/LandingHero'
import LandingIn30Seconds from '@/components/site/LandingIn30Seconds'
import LandingDifferent  from '@/components/site/LandingDifferent'
import LandingTryRules   from '@/components/site/LandingTryRules'
import LandingUseCases   from '@/components/site/LandingUseCases'
import LandingLiveOnArc  from '@/components/site/LandingLiveOnArc'
import LandingWhyArc     from '@/components/site/LandingWhyArc'
import LandingSafety     from '@/components/site/LandingSafety'
import LandingFaq        from '@/components/site/LandingFaq'
import LandingCta        from '@/components/site/LandingCta'

interface Props {
  onSend:     () => void
  onSent:     () => void
  onReceived: () => void
  onHow:      () => void
  onAbout:    () => void
}

export default function HomePage({ onSend, onSent, onReceived, onHow, onAbout }: Props) {
  return (
    <>
      <SiteHeader onOpenApp={onSend} onHow={onHow} onAbout={onAbout} />
      <main>
        <LandingHero       onSend={onSend} />
        <LandingIn30Seconds />
        <LandingUseCases />
        <LandingDifferent />
        <LandingTryRules />
        <LandingLiveOnArc />
        <LandingWhyArc />
        <LandingSafety />
        <LandingFaq />
        <LandingCta onSend={onSend} />
      </main>
      <SiteFooter
        onSend={onSend}
        onSent={onSent}
        onReceived={onReceived}
        onHow={onHow}
        onAbout={onAbout}
      />
    </>
  )
}
