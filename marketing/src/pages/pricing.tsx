import React from 'react'
import type { HeadFC, PageProps } from 'gatsby'
import DefaultPageWrapper from '../components/DefaultPageWrapper'
import Pricing from '../components/Pricing'

const PricingPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper>
            <main id="main" className="container">
                <h1 className="text-center mt-3">BeddyBytes Pricing</h1>
                <Pricing />
            </main>
        </DefaultPageWrapper>
    )
}

export default PricingPage

export const Head: HeadFC = () => <title>Pricing - BeddyBytes</title>