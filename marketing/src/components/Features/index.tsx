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
                <h3><span>🏡</span> Freedom to roam</h3>
                <p>
                    Keep an eye or ear on your little one from anywhere your WiFi reaches.
                    Popping outside to hang washing just got a whole lot easier.
                </p>
            </FeatureSection>
            <FeatureSection>
                <h3><span>🔉</span> Audio only monitoring</h3>
                <p>
                    For when you just need the basics - BeddyBytes has an audio only mode.
                    Listen to your little one sleeping or playing in another room.
                </p>
            </FeatureSection>
            <FeatureSection>
                <h3><span>📹</span> Video and audio monitoring</h3>
                <p>
                    Watch and listen to your baby sing and chat themselves to sleep.
                </p>
            </FeatureSection>
            <FeatureSection>
                <h3><span>🔴</span> Recording</h3>
                <p>
                    Recording those especially cute moments is just a click away and
                    completely private - recordings are stored on your local storage
                    (i.e. on your own device).
                </p>
            </FeatureSection>
            <FeatureSection>
                <h3><span>💻</span> Monitor from multiple devices</h3>
                <p>
                    Watch your baby on your phone while you're eating lunch that went
                    cold during the putdown. Then switch to monitoring from your laptop
                    while you're working. More than one caregiver can monitor your
                    baby on their own devices (mobiles, tablets and laptops) at the same
                    time.
                </p>
            </FeatureSection>
            <FeatureSection>
                <h3><span>💚</span> Environmentally friendly</h3>
                <p>
                    Most smartphones, tablets and laptops will support BeddyBytes, giving
                    old devices a new lease on life and reducing e-waste.
                </p>
            </FeatureSection>
            <FeatureSection>
                <h3><span>🔒</span> Did we mention privacy?</h3>
                <p>
                    It's our top concern. BeddyBytes is completely private - your images 
                    and videos never leave your own devices. 
                </p>
            </FeatureSection>
        </div>
    </section>
)

export default Features;