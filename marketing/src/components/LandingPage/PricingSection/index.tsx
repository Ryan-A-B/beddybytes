import React from 'react'
import Pricing from '../../Pricing'

interface Props {
    variant?: "white" | "purple"
    className?: string
}

const PricingSection: React.FunctionComponent<Props> = ({ className, variant = "white" }) => (
    <section id="pricing" className={`pricing-section${variant === "purple" ? " pricing-section--purple" : ""} ${className || ''}`}>
        <div className="container">
            <Pricing />
        </div>
    </section>
)

export default PricingSection
