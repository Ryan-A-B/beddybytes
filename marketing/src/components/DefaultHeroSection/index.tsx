import React from "react";
import CallToAction from "../CallToAction";

import "./style.scss";

interface Props {
    children: [React.ReactNode, React.ReactNode];
}

const DefaultHeroSection: React.FunctionComponent<Props> = ({ children: [copy, image] }) => (
    <section className="hero bg-primary text-light">
        <div className="container">
            <div className="row align-items-center">
                <div className="col-lg-6">
                    {copy}
                    <CallToAction to="/pricing" color="light" click_id="cta-hero-section" />
                </div>
                <div className="d-none d-lg-block col">
                    {image}
                </div>
            </div>
        </div>
    </section>
)

export default DefaultHeroSection;