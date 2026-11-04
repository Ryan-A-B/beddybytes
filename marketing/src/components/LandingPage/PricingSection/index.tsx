import React from 'react'
import Pricing from '../../Pricing'

interface Props {
    className?: string
}

const PricingSection: React.FunctionComponent<Props> = ({ className }) => (
    <section id="pricing" className={`pricing-section ${className || ''}`}>
        <div className="container">
            <Pricing />
        </div>
    </section>
)

export default PricingSection
