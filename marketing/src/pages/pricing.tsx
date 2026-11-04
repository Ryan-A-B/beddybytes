import React from "react"
import { type HeadFC, type PageProps } from "gatsby"
import SEOHead from "../components/SEOHead"
import DefaultPageWrapper from "../components/DefaultPageWrapper"
import Pricing from "../components/Pricing"
import SocialProofSection from "../components/SocialProof/Section"
import FAQSection from "../components/LandingPage/FAQSection"

const PricingPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper without_call_to_action>
            <main id="page-pricing" className="pricing-section">
                <div className="container">
                    <Pricing heading="h1" />
                </div>
            </main>
            <SocialProofSection />
            <FAQSection />
        </DefaultPageWrapper>
    )
}

export default PricingPage

export const Head: HeadFC = () => (
    <SEOHead
        title="BeddyBytes Pricing | One-Time Purchase Baby Monitor"
        description="Lifetime access for $35 USD. No subscription. Start your 7 day free trial of BeddyBytes. No credit card required."
        pathname="/pricing/"
    />
)
