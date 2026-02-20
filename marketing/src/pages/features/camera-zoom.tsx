import React from "react";
import type { HeadFC } from "gatsby";
import { StaticImage } from "gatsby-plugin-image";
import DefaultPageWrapper from "../../components/DefaultPageWrapper";
import DefaultHeroSection from "../../components/DefaultHeroSection";
import SEOHead from "../../components/SEOHead";
import FAQSection from "../../components/LandingPage/FAQSection";

type ZoomComparisonSliderProps = {
    className?: string;
};

const ZoomComparisonSlider: React.FunctionComponent<ZoomComparisonSliderProps> = ({ className }) => {
    const [splitPercentage, setSplitPercentage] = React.useState(50);
    const sliderRef = React.useRef<HTMLDivElement | null>(null);
    const isDraggingRef = React.useRef(false);

    const setSplitFromClientX = React.useCallback((clientX: number) => {
        if (sliderRef.current == null) {
            return;
        }

        const sliderRect = sliderRef.current.getBoundingClientRect();
        if (sliderRect.width <= 0) {
            return;
        }

        const nextSplitPercentage = ((clientX - sliderRect.left) / sliderRect.width) * 100;
        const clampedSplitPercentage = Math.max(0, Math.min(100, nextSplitPercentage));
        setSplitPercentage(clampedSplitPercentage);
    }, []);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        isDraggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        setSplitFromClientX(event.clientX);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) {
            return;
        }

        setSplitFromClientX(event.clientX);
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (isDraggingRef.current) {
            setSplitFromClientX(event.clientX);
        }
        isDraggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    return (
        <section className={className}>
            <div style={{ width: "100%", maxWidth: 380, margin: "0 auto" }}>
                <div
                    ref={sliderRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onDragStart={(event) => {
                        event.preventDefault();
                    }}
                    role="slider"
                    aria-label="Compare zoomed in and zoomed out views"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(splitPercentage)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowLeft") {
                            setSplitPercentage((currentSplitPercentage) => Math.max(0, currentSplitPercentage - 2));
                        }

                        if (event.key === "ArrowRight") {
                            setSplitPercentage((currentSplitPercentage) => Math.min(100, currentSplitPercentage + 2));
                        }
                    }}
                    style={{
                        position: "relative",
                        aspectRatio: "1080 / 2316",
                        overflow: "hidden",
                        borderRadius: 12,
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        cursor: "ew-resize",
                        touchAction: "none",
                        userSelect: "none",
                    }}
                >
                    <StaticImage
                        src="../../images/ZoomIn.jpg"
                        alt="Baby station view zoomed in"
                        transformOptions={{ fit: "cover" }}
                        style={{ height: "100%" }}
                        imgStyle={{
                            height: "100%",
                            width: "100%",
                            objectFit: "cover",
                            userSelect: "none",
                            pointerEvents: "none",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            clipPath: `inset(0 ${100 - splitPercentage}% 0 0)`,
                        }}
                    >
                        <StaticImage
                            src="../../images/ZoomOut.jpg"
                            alt="Baby station view zoomed out"
                            transformOptions={{ fit: "cover" }}
                            style={{ height: "100%" }}
                            imgStyle={{
                                height: "100%",
                                width: "100%",
                                objectFit: "cover",
                                userSelect: "none",
                                pointerEvents: "none",
                            }}
                        />
                    </div>
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: `${splitPercentage}%`,
                            width: 2,
                            transform: "translateX(-50%)",
                            backgroundColor: "#ffffff",
                            boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.2)",
                        }}
                    />
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: `${splitPercentage}%`,
                            transform: "translate(-50%, -50%)",
                            width: 42,
                            height: 42,
                            borderRadius: "50%",
                            border: "2px solid #fff",
                            backgroundColor: "#1f1f1f",
                            color: "#fff",
                            fontSize: 18,
                            lineHeight: "1",
                            padding: 0,
                            zIndex: 2,
                            cursor: "ew-resize",
                            pointerEvents: "none",
                            display: "grid",
                            placeItems: "center",
                        }}
                    >
                        ↔
                    </div>
                </div>
            </div>
        </section>
    );
};

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
            <section className="bg-body-secondary py-5">
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
        title="Camera Zoom That Keeps the Cot Centered"
        description="Pinch to zoom on the baby station to keep the cot centered when your phone can't be close."
    />
);
