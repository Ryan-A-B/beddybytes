import React from 'react'
import type { HeadFC, PageProps } from 'gatsby'
import SEOHead from '../components/SEOHead'
import DefaultPageWrapper from '../components/DefaultPageWrapper'
import Pricing from '../components/Pricing'
import TrialPeriod from '../components/Pricing/TrialPeriod'
import RedirectToSquare from '../components/Pricing/RedirectToSquare'

const maxWidth = 760

const PricingPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper without_call_to_action_section>
            <main className="container" style={{ maxWidth }}>
                <h1 className="text-center mt-3 fs-5">Pricing</h1>
                <h4 className="text-center fs-2">No Subscription</h4>
                <RedirectToSquare />
                <Pricing />
                <TrialPeriod />
            </main>
        </DefaultPageWrapper>
    )
}

export default PricingPage

export const Head: HeadFC = () => <SEOHead title="BeddyBytes Pricing" description="BeddyBytes pricing information" />