import React from "react";
import type { HeadFC } from "gatsby";

import DefaultPageWrapper from "../../components/DefaultPageWrapper";
import DefaultHeroSection from "../../components/DefaultHeroSection";
import { StaticImage } from "gatsby-plugin-image";
import SEOHead from "../../components/SEOHead";

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
                <StaticImage
                    src="../../images/Recording.png"
                    alt="baby monitor recording"
                    aspectRatio={16 / 9}
                    transformOptions={{ fit: "contain" }}
                />
            </DefaultHeroSection>
            <section className="bg-body-tertiary py-5">
                <div className="container">
                    <h2>Record your baby's sounds</h2>
                    <p>
                        BeddyBytes is a baby monitor that records your baby's sounds. You can listen back to the recordings and share them with your friends and family.
                    </p>
                </div>
            </section>
            <section className="bg-body-secondary py-5">
                <div className="container">
                    <div className="row">
                        <div className="col-sm-auto mx-auto">
                            <h2>How to record using BeddyBytes</h2>
                            <ol>
                                <li>Select a session from the Parent Station</li>
                                <li>Click on the record button to start recording</li>
                                <li>Click on the record button again to stop recording</li>
                                <li>The recording will be automatically downloaded</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    </DefaultPageWrapper>
)

export default RecordingFeaturePage

export const Head: HeadFC = () => <SEOHead title="BeddyBytes Recording" description="Record your baby's sounds with BeddyBytes" />