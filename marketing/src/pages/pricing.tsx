import React from "react"
import type { HeadFC, PageProps } from "gatsby"
import SEOHead from "../components/SEOHead"
import DefaultPageWrapper from "../components/DefaultPageWrapper"
import Pricing from "../components/Pricing"
import SocialProofSection from "../components/SocialProof/Section"
import AllPlansInclude from "../components/Pricing/AllPlansInclude"
import { OnePurchase, RedirectToPaymentProcessor } from "../components/Pricing/Messages"

const PricingPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper without_call_to_action>
            <main id="page-pricing" className="bg-primary text-bg-primary py-5">
                <div className="container">
                    <h1 className="text-center mt-3">Simple. Private. Yours.</h1>
                    <p className="fs-5 text-center">A monitor that minds its own business.</p>
                    <div className="bg-light text-bg-light p-3 rounded">
                        <AllPlansInclude />
                        <Pricing />
                        <OnePurchase />
                        <RedirectToPaymentProcessor />
                    </div>
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
        pathname="/pricing/"
    />
)
