import React from "react";
import type { HeadFC } from "gatsby";
import { StaticImage } from "gatsby-plugin-image";
import DefaultPageWrapper from "../../components/DefaultPageWrapper";
import DefaultHeroSection from "../../components/DefaultHeroSection";
import SEOHead from "../../components/SEOHead";
import FAQSection from "../../components/LandingPage/FAQSection";

const CameraZoomFeaturePage: React.FunctionComponent = () => (
    <DefaultPageWrapper>
        <main id="main">
            <DefaultHeroSection>
                <React.Fragment>
                    <h1>Camera zoom for your baby monitor</h1>
                    <p>
                        Pinch-to-zoom and pan on the baby station so you can
                        reframe the view before bedtime.
                    </p>
                </React.Fragment>
                <StaticImage
                    src="https://placekitten.com/1200/675"
                    alt="camera zoom placeholder"
                    aspectRatio={16 / 9}
                    transformOptions={{ fit: "cover" }}
                />
            </DefaultHeroSection>
            <section className="bg-body-tertiary py-5">
                <div className="container">
                    <h2 className="text-center">
                        Simple zoom and pan controls
                    </h2>
                    <div className="row mt-4">
                        <div className="col-lg">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h3 className="card-title fs-5">
                                        Pinch to zoom
                                    </h3>
                                    <p>
                                        Zoom in for a closer view with a simple
                                        two-finger pinch.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h3 className="card-title fs-5">
                                        Pan to reframe
                                    </h3>
                                    <p>
                                        Drag to keep the cot centered in frame
                                        after you move the phone.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h3 className="card-title fs-5">
                                        Built for setup
                                    </h3>
                                    <p>
                                        Adjust the view on the baby station
                                        before you start monitoring.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section className="bg-body-secondary py-5">
                <div className="container">
                    <div className="row">
                        <div className="col-sm-auto mx-auto">
                            <h2>How to use camera zoom</h2>
                            <ol>
                                <li>Open Baby Station</li>
                                <li>Pinch to zoom in or out</li>
                                <li>Drag to pan and reframe</li>
                                <li>Start monitoring</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </section>
            <section className="bg-secondary text-bg-secondary py-5">
                <div className="container">
                    <section>
                        <h2>When the camera has to move</h2>
                        <ul>
                            <li>
                                Move the phone out of reach, then zoom in for a
                                closer view.
                            </li>
                            <li>
                                Reframe after repositioning the baby station.
                            </li>
                            <li>
                                Adjust once before bedtime so your view is set.
                            </li>
                        </ul>
                    </section>
                </div>
            </section>
        </main>
        <FAQSection />
    </DefaultPageWrapper>
);

export default CameraZoomFeaturePage;

export const Head: HeadFC = () => (
    <SEOHead
        title="Camera zoom for baby monitor"
        description="Pinch-to-zoom and pan on the baby station so you can reframe the view before bedtime."
    />
);
