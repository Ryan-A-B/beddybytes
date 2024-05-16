import React from 'react'

type Props = {
    children: [React.ReactNode, React.ReactNode]
}

const FeatureSection: React.FunctionComponent<Props> = ({ children: [body, image] }) => (
    <section className="feature">
        <div className="container">
            <div className="row align-items-center">
                <div className="feature-body col-lg-6">
                    {body}
                </div>
                <div className="feature-image d-none d-lg-block col">
                    {image}
                </div>
            </div>
        </div>
    </section>
)

export default FeatureSection;