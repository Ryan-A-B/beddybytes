import React from 'react'

type Props = {
    children: React.ReactNode
}

const FeatureSection: React.FunctionComponent<Props> = ({ children }) => (
    <section className="feature">
        <div className="container">
            {children}
        </div>
    </section>
)

export default FeatureSection;