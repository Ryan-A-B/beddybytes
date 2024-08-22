import React from 'react'
import Pricing from '../../Pricing'
import TrialPeriod from '../../Pricing/TrialPeriod'

import "./style.scss"
import RedirectToSquare from '../../Pricing/RedirectToSquare'

const PricingSection: React.FunctionComponent = () => {
    return (
        <section id="pricing">
            <div className="container">
                <h2 className="text-center fs-6">Pricing</h2>
                <h6 className="text-center fs-2">No subscription</h6>
                <RedirectToSquare />
                <Pricing />
                <TrialPeriod />
            </div>
        </section>
    )
}

export default PricingSection