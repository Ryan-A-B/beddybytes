import React from "react"
import type { HeadFC, PageProps } from "gatsby"
import SEOHead from "../components/SEOHead"
import DefaultPageWrapper from "../components/DefaultPageWrapper"
import Pricing from "../components/Pricing"
import SocialProofSection from "../components/SocialProof/Section"
import AllPlansInclude from "../components/Pricing/AllPlansInclude"
import { OnePurchase, RedirectToPaymentProcessor, TrialPeriod } from "../components/Pricing/Messages"

const maxWidth = 800

const PricingPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper without_call_to_action>
            <main id="page-pricing" className="bg-primary text-bg-primary py-5">
                <div className="container" style={{ maxWidth }}>
                    <h1 className="text-center mt-3">Simple. Private. Yours.</h1>
                    <p className="text-center">A monitor that minds its own business.</p>
                    <AllPlansInclude />
                    <Pricing />
                    <OnePurchase />
                    <RedirectToPaymentProcessor />
                </div>
            </main>
            <SocialProofSection />
        </DefaultPageWrapper>
    )
}

export default PricingPage

export const Head: HeadFC = () => (
    <SEOHead
        title="BeddyBytes Pricing"
        description="BeddyBytes pricing information"
    />
)