import React from 'react'
import Pricing from '../../Pricing'
import { OnePurchase, RedirectToPaymentProcessor } from '../../Pricing/Messages'

import "./style.scss"
import AllPlansInclude from '../../Pricing/AllPlansInclude'

const PricingSection: React.FunctionComponent = () => {
    return (
        <section id="pricing">
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