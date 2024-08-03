import React from 'react'
import Pricing from '../../Pricing'

import "./style.scss"
import TrialPeriod from './TrialPeriod'

const PricingSection: React.FunctionComponent = () => {
    return (
        <section id="pricing">
            <div className="container">
                <h6 className="text-center">Pricing</h6>
                <h2 className="text-center">No subscription</h2>
                <Pricing />
                <TrialPeriod />
            </div>
        </section>
    )
}

export default PricingSection