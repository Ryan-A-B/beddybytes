import React from "react";

import "./style.scss";

interface Props {
    children: [React.ReactNode, React.ReactNode];
}

const DefaultHowToSection: React.FunctionComponent<Props> = ({ children: [copy, image] }) => (
    <section className="how-to bg-body-secondary">
        <div className="container">
            <div className="row align-items-center">
                <div className="col-lg-6">
                    {copy}
                </div>
                <div className="d-none d-lg-block col">
                    {image}
                </div>
            </div>
        </div>
    </section>
)

export default DefaultHowToSection;