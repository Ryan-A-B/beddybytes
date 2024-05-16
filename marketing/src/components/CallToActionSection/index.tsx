import React from 'react';
import CallToAction from './CallToAction';

const CallToActionSection: React.FunctionComponent = () => (
    <section className="bg-primary text-light py-5">
        <div className="container text-center">
            <h2>Get started today</h2>
            <CallToAction />
        </div>
    </section>
)

export default CallToActionSection;
