/**
 * HomePage — the public landing page.
 * Composed of section components; uses SiteHeader + SiteFooter.
 * The app shell (tab bar, wallet header) is NOT rendered here — that's App.tsx for app pages.
 */
import SiteHeader from '@/components/site/SiteHeader'
import SiteFooter from '@/components/site/SiteFooter'
import LandingHero from '@/components/site/LandingHero'
import LandingProblem from '@/components/site/LandingProblem'
import LandingHow from '@/components/site/LandingHow'
import LandingTryRules from '@/components/site/LandingTryRules'
import LandingUseCases from '@/components/site/LandingUseCases'
import LandingLiveOnArc from '@/components/site/LandingLiveOnArc'
import LandingWhyArc from '@/components/site/LandingWhyArc'
import LandingSafety from '@/components/site/LandingSafety'
import LandingFaq from '@/components/site/LandingFaq'
import LandingCta from '@/components/site/LandingCta'

interface Props {
  onSend: () => void
  onSent: () => void
  onReceived: () => void
  onHow: () => void
  onAbout: () => void
}

export default function HomePage({ onSend, onSent, onReceived, onHow, onAbout }: Props) {
  return (
    <>
      <SiteHeader onOpenApp={onSend} onHow={onHow} onAbout={onAbout} />
      <main>
        <LandingHero onSend={onSend} />
        <LandingProblem />
        <LandingHow />
        <LandingTryRules />
        <LandingUseCases />
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
