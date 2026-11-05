import React from 'react';
import CallToAction from '../CallToAction';

interface Props {
    className?: string
}

const CallToActionSection: React.FunctionComponent<Props> = ({ className }) => (
    <section className={`bg-primary text-light ${className ?? 'py-5'}`}>
        <div className="container text-center">
            <h2>Get started today</h2>
            <CallToAction
                color="light"
                click_id="cta-cta-section"
            />
        </div>
    </section>
)

export default CallToActionSection;
