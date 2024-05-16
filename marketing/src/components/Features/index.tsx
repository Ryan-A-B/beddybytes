import React from "react";

import FeatureSection from "./FeatureSection";

import "./style.scss";

interface Props {
    backgroundClassName?: string;
    children: React.ReactNode;
}

const Features: React.FunctionComponent<Props> = ({ backgroundClassName = "bg-body-tertiary", children: heading }) => (
    <section className={`features ${backgroundClassName} py-5`}>
        <div className="container">
            {heading}
            <FeatureSection>
                <React.Fragment>
                    <h3>Video and audio monitoring</h3>
                    <p>
                        Keep an eye on your little one from anywhere your home WiFi reaches.
                    </p>
                </React.Fragment>
                <img src="https://via.placeholder.com/640x360" alt="Placeholder" className="img-fluid" />
            </FeatureSection>
            <FeatureSection>
                <React.Fragment>
                    <h3>Audio only monitoring</h3>
                    <p>
                        If a baby monitor only has one feature, this is it.
                    </p>
                </React.Fragment>
                <img src="https://via.placeholder.com/640x360" alt="Placeholder" className="img-fluid" />
            </FeatureSection>
            <FeatureSection>
                <React.Fragment>
                    <h3>Monitor from multiple devices</h3>
                    <p>
                        Monitor from your phone while your grabbing some lunch, and from your laptop while you're working.
                    </p>
                </React.Fragment>
                <img src="https://via.placeholder.com/640x360" alt="Placeholder" className="img-fluid" />
            </FeatureSection>
            <FeatureSection>
                <React.Fragment>
                    <h3>Monitor from any modern web browser</h3>
                    <p>
                        Simply log in and you're good to go.
                    </p>
                </React.Fragment>
                <img src="https://via.placeholder.com/640x360" alt="Placeholder" className="img-fluid" />
            </FeatureSection>
            <FeatureSection>
                <React.Fragment>
                    <h3>Recording</h3>
                    <p>
                        There aren't many things cuter than a baby talking and singing to themselves in their
                        cot (except when it's 3am and they want to “Dance? Dance? Dance?”).
                    </p>
                </React.Fragment>
                <img src="https://via.placeholder.com/640x360" alt="Placeholder" className="img-fluid" />
            </FeatureSection>
        </div>
    </section>
)

export default Features;