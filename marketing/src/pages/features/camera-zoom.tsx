import React from "react";
import type { HeadFC } from "gatsby";
import DefaultPageWrapper from "../../components/DefaultPageWrapper";
import DefaultHeroSection from "../../components/DefaultHeroSection";
import SEOHead from "../../components/SEOHead";
import FAQSection from "../../components/LandingPage/FAQSection";
import ZoomComparisonSlider from "../../components/ZoomComparisonSlider";

const CameraZoomFeaturePage: React.FunctionComponent = () => (
    <DefaultPageWrapper>
        <main id="main" className="feature-page">
            <DefaultHeroSection>
                <React.Fragment>
                    <h1>Camera zoom that keeps your view where you need it</h1>
                    <p>
                        When your phone can&apos;t be close, zoom in and keep the
                        cot centered. Simple controls that just work.
                    </p>
                </React.Fragment>
                <ZoomComparisonSlider />
            </DefaultHeroSection>
            <section className="bg-body-tertiary py-5">
                <div className="container">
                    <section className="mx-auto" style={{ maxWidth: 720 }}>
                        <h2>Why we added camera zoom</h2>
                        <p>
                            The need for zoom arose after our little one tried
                            to get in some unauthorized screen time, grabbing
                            the phone from the edge of the cot. We moved the
                            phone to safety, and suddenly the cot looked like a
                            tiny postcard. Zoom let us keep a clear view without
                            putting the phone back within reach.
                        </p>
                    </section>
                </div>
            </section>
            <section className="bg-body-tertiary py-5 d-lg-none">
                <div className="container">
                    <h2 className="text-center">Compare zoom levels</h2>
                    <p className="text-center mb-0">
                        Drag the slider to see zoom in vs zoom out on the same scene.
                    </p>
                    <div className="mt-4">
                        <ZoomComparisonSlider className="d-lg-none" />
                    </div>
                </div>
            </section>
            <section className="bg-body-secondary py-5">
                <div className="container">
                    <h2 className="text-center">
                        Watch setup, zoom, and framing in action
                    </h2>
                    <div className="d-flex justify-content-center mt-4">
                        <div style={{ width: "100%", maxWidth: 360 }}>
                            <video
                                controls
                                playsInline
                                preload="metadata"
                                title="Setting up baby station and adjusting zoom and pan"
                                style={{ width: "100%", display: "block", backgroundColor: "#000" }}
                            >
                                <source src="/videos/Zoom-web-30fps.mp4" type="video/mp4" />
                            </video>
                        </div>
                    </div>
                </div>
            </section>
            <section className="bg-body-tertiary py-5">
                <div className="container">
                    <h2 className="text-center">Simple zoom controls</h2>
                    <div className="row mt-4">
                        <div className="col-lg">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h3 className="card-title fs-5">
                                        Pinch to zoom
                                    </h3>
                                    <p>
                                        Bring the cot closer with a two-finger
                                        pinch. No fuss, no extra steps.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h3 className="card-title fs-5">
                                        Private stream, simple setup
                                    </h3>
                                    <p>
                                        Zoom works within the same private,
                                        reliable stream - no extra hoops.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h3 className="card-title fs-5">
                                        Set it once
                                    </h3>
                                    <p>
                                        Frame the view on the baby station
                                        before you start monitoring.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section className="bg-secondary text-bg-secondary py-5">
                <div className="container">
                    <div className="row">
                        <div className="col-sm-auto mx-auto">
                            <h2>How to use camera zoom</h2>
                            <ol>
                                <li>Open Baby Station</li>
                                <li>Pinch to zoom in or out</li>
                                <li>Adjust the view to keep the cot centered</li>
                                <li>Start monitoring</li>
                            </ol>
                            <p className="mt-4 mb-0">
                                Camera zoom is for quick setup before you
                                step away. It is optional and uses digital
                                zoom.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
        <FAQSection />
    </DefaultPageWrapper>
);

export default CameraZoomFeaturePage;

export const Head: HeadFC = () => (
    <SEOHead
        title="Baby Monitor Camera Zoom | No Cloud Processing | BeddyBytes"
        description="Zoom in on the Baby Station to keep the cot centered. BeddyBytes applies zoom locally on your device with no cloud processing."
        pathname="/features/camera-zoom/"
    />
);
