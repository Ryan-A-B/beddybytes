import React from "react"
import type { HeadFC, PageProps } from "gatsby"
import SEOHead from "../components/SEOHead"
import DefaultPageWrapper from "../components/DefaultPageWrapper"
import Pricing from "../components/Pricing"
import SocialProofSection from "../components/SocialProof/Section"
import AllPlansInclude from "../components/Pricing/AllPlansInclude"
import { OnePurchase, RedirectToPaymentProcessor } from "../components/Pricing/Messages"
import FAQSection from "../components/LandingPage/FAQSection"

const PricingPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper without_call_to_action>
            <main id="page-pricing" className="bg-primary text-bg-primary py-5">
                <div className="container">
                    <h1 className="text-center mt-3">One-time purchase baby monitor pricing</h1>
                    <p className="fs-5 text-center">Simple. Private. Yours.</p>
                    <p className="text-center">
                        Choose a one-time purchase plan with no subscription and
                        access BeddyBytes across all your devices.
                    </p>
                    <div className="bg-light text-bg-light p-3 rounded">
                        <AllPlansInclude />
                        <Pricing />
                        <OnePurchase />
                        <RedirectToPaymentProcessor />
                    </div>
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
        description="One-time purchase baby monitor pricing from BeddyBytes. No subscription, unlimited stations, and a 30-day refund guarantee."
        pathname="/pricing/"
    />
)
