import React from 'react'
import Pricing from '../../Pricing'
import { OnePurchase, RedirectToPaymentProcessor } from '../../Pricing/Messages'
import AllPlansInclude from '../../Pricing/AllPlansInclude'

interface Props {
    className?: string
}

const PricingSection: React.FunctionComponent<Props> = ({ className }) => {
    return (
        <section id="pricing" className={className}>
            <div className="container">
                <h2 className="text-center">Pricing</h2>
                <div className="bg-light text-bg-light p-3 rounded">
                    <AllPlansInclude />
                    <Pricing />
                    <OnePurchase />
                    <RedirectToPaymentProcessor />
                </div>
            </div>
        </section>
    )
}

export default PricingSection
