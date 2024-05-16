import React from "react";
import type { HeadFC } from "gatsby";

import DefaultPageWrapper from "../../components/DefaultPageWrapper";
import DefaultHeroSection from "../../components/DefaultHeroSection";
import DefaultHowToSection from "../../components/DefaultHowToSection";

const RecordingFeaturePage: React.FunctionComponent = () => (
    <DefaultPageWrapper>
        <main id="main">
            <DefaultHeroSection>
                <React.Fragment>
                    <h1>Baby monitor that records</h1>
                    <p>
                        Record those precious moments when your baby is talking and singing to themselves in their cot.
                    </p>
                </React.Fragment>
                <img src="https://via.placeholder.com/640x360" alt="Placeholder" className="img-fluid" />
            </DefaultHeroSection>
            <section className="bg-body-tertiary py-5">
                <div className="container">
                    <h2>Record your baby's sounds</h2>
                    <p>
                        BeddyBytes is a baby monitor that records your baby's sounds. You can listen back to the recordings and share them with your friends and family.
                    </p>
                </div>
            </section>
            <DefaultHowToSection>
                <React.Fragment>
                    <h2>How to record using BeddyBytes</h2>
                    <ol>
                        <li>Select a session from the Parent Station</li>
                        <li>Click on the record button to start recording</li>
                        <li>Click on the record button again to stop recording</li>
                        <li>The recording will be automatically downloaded</li>
                    </ol>
                </React.Fragment>
                <img src="https://via.placeholder.com/640x360" alt="Placeholder" className="img-fluid" />
            </DefaultHowToSection>
        </main>
    </DefaultPageWrapper>
)

export default RecordingFeaturePage

export const Head: HeadFC = () => <title>Baby monitor that records</title>