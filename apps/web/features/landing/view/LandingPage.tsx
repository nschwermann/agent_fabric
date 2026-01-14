import { HeroSection } from './HeroSection'
import { FeatureSection } from './FeatureSection'
import { HowItWorksSection } from './HowItWorksSection'
import { MarketplacePreview } from './MarketplacePreview'
import { CtaSection } from './CtaSection'

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeatureSection />
      <HowItWorksSection />
      <MarketplacePreview />
      <CtaSection />
    </div>
  )
}
