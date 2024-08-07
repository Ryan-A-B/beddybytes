import React from 'react'
import type { HeadFC, PageProps } from 'gatsby'
import DefaultPageWrapper from '../components/DefaultPageWrapper'
import Pricing from '../components/Pricing'
import TrialPeriod from '../components/Pricing/TrialPeriod'

const maxWidth = 760

const PricingPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper without_call_to_action_section>
            <main className="container" style={{ maxWidth }}>
                <h1 className="text-center mt-3">BeddyBytes Pricing</h1>
                <Pricing />
                <TrialPeriod />
            </main>
        </DefaultPageWrapper>
    )
}

export default PricingPage

export const Head: HeadFC = () => <title>Pricing - BeddyBytes</title>