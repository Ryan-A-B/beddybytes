import React from "react";
import type { HeadFC } from "gatsby";
import { StaticImage } from "gatsby-plugin-image";
import DefaultPageWrapper from "../../components/DefaultPageWrapper";
import DefaultHeroSection from "../../components/DefaultHeroSection";
import SEOHead from "../../components/SEOHead";
import FAQSection from "../../components/LandingPage/FAQSection";

const VideoFeaturePage: React.FunctionComponent = () => (
    <DefaultPageWrapper>
        <main id="main">
            <DefaultHeroSection>
                <React.Fragment>
                    <h1>
                        Video baby monitor
                    </h1>
                    <p>
                        Keep an eye on your baby with our video baby monitor.
                        Stream securely over your home WiFi with BeddyBytes.
                    </p>
                </React.Fragment>
                <StaticImage
                    src="../../images/Video.png"
                    alt="BeddyBytes video baby monitor"
                    aspectRatio={16 / 9}
                    transformOptions={{ fit: "contain" }}
                />
            </DefaultHeroSection>
            <section className="bg-body-tertiary py-5">
                <div className="container">
                    <h2 className="text-center">
                        Private and flexible video monitoring
                    </h2>
                    <div className="row mt-4">
                        <div className="col-lg">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h3 className="card-title fs-5">
                                        Peace of mind, wherever you are
                                    </h3>
                                    <p>
                                        Turn your devices into trusted baby
                                        stations with BeddyBytes, streaming
                                        securely over your home WiFi. Not a
                                        single frame leaves your home - just
                                        you, baby, and total privacy.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h3 className="card-title fs-5">
                                        Switch, connect, relax
                                    </h3>
                                    <p>
                                        Use any device with a browser to
                                        monitor your little one. Switch
                                        between screens seamlessly, keeping
                                        peace of mind wherever you go.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h3 className="card-title fs-5">
                                        Instant baby monitor magic
                                    </h3>
                                    <p>
                                        Turn any device with a browser, camera,
                                        and microphone into your baby station!
                                        BeddyBytes works seamlessly, so you
                                        stay connected without the stress.
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
                            <h2>How to stream video using BeddyBytes</h2>
                            <ol>
                                <li>
                                    Setup Baby Station
                                    <ol>
                                        <li>Select Baby Station from the menu</li>
                                        <li>Pick the camera you'd like to use from the dropdown</li>
                                        <li>Click start</li>
                                    </ol>
                                </li>
                                <li>
                                    Connect Parent Station
                                    <ol>
                                        <li>Open Parent Station</li>
                                        <li>Click on the Baby Station you'd like to connect to</li>
                                    </ol>
                                </li>
                                <li>Enjoy a well earned break</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </section>
            <section className="bg-secondary text-bg-secondary py-5">
                <div className="container">
                    <section>
                        <h2>
                            Keep an eye on your baby
                        </h2>
                        <ul>
                            <li>
                                Check in on what they're complaining about.
                                Maybe they're making some noise in their sleep.
                                And maybe they've got a leg stuck in the crib.
                                You'll know exactly what's going on.
                            </li>
                            <li>
                                Watch as they decide to make an escape attempt.
                                So you can be ready at the door when they
                                figure out the handle.
                            </li>
                            <li>
                                Make sure your little one is actually sleeping.
                                We've watched ours have an amazing dance party
                                in her cot for 90 minutes of a 2 hour nap. At
                                least you can brace yourself for the gremlin
                                that will emerge.
                            </li>
                        </ul>
                    </section>
                    <section className="pt-5">
                        <h2>
                            Get some work done
                        </h2>
                        <ul>
                            <li>
                                Pop your phone on the counter and keep an eye
                                on your baby while you do the dishes. Just
                                don't drop the phone in the sink!
                            </li>
                            <li>
                                Open the parent station on your laptop while
                                you pay those pesky bills. At least you can
                                sit down while you do it!
                            </li>
                            <li>
                                Put your tablet on the coffee table while you
                                fold laundry. Just put the washing away before
                                your little one wakes up and decides to "help".
                            </li>
                        </ul>
                    </section>
                    <section className="pt-5">
                        <h2>
                            Relax
                        </h2>
                        <ul>
                            <li>
                                Watch your little one on your tablet while you
                                take a break on the couch. You deserve it!
                            </li>
                            <li>
                                Enjoy a coffee on the porch while you keep an
                                eye on your baby with your phone. Ah, fresh air!
                            </li>
                            <li>
                                Put the screen on the floor so you can see it
                                through the face hole in the massage table. Ha.
                                I can dream, right?
                            </li>
                        </ul>
                    </section>
                </div>
            </section>
        </main>
        <FAQSection />
    </DefaultPageWrapper>
);

export default VideoFeaturePage;

export const Head: HeadFC = () => (
    <SEOHead
        title="Video baby monitor"
        description="Keep an eye on your baby with our video baby monitor. Stream securely over your home WiFi with BeddyBytes."
    />
);
