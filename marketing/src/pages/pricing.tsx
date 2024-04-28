import React from 'react'
import type { HeadFC, PageProps } from 'gatsby'
import DefaultPageWrapper from '../components/DefaultPageWrapper'
import Pricing from '../components/Pricing'
import FeaturesCurrent from '../components/FeaturesCurrent'
import FeaturesComingSoon from '../components/FeaturesComingSoon'

const PricingPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper>
            <h1 className="text-center mt-3">BeddyBytes Pricing</h1>
            <Pricing />
            <section className="py-5">
                <h2 className="text-center">Features</h2>
                <div className="row justify-content-center">
                    <div className="col">
                        <FeaturesCurrent />
                    </div>
                    <div className="col">
                        <FeaturesComingSoon />
                    </div>
                </div>
            </section>
        </DefaultPageWrapper>
    )
}

export default PricingPage

export const Head: HeadFC = () => <title>Pricing - BeddyBytes</title>