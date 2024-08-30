import React from "react";
import type { HeadFC } from "gatsby";
import { StaticImage } from "gatsby-plugin-image";
import DefaultPageWrapper from "../../components/DefaultPageWrapper";
import DefaultHeroSection from "../../components/DefaultHeroSection";
import SEOHead from "../../components/SEOHead";
import FAQSection from "../../components/LandingPage/FAQSection";

const RecordingFeaturePage: React.FunctionComponent = () => (
    <DefaultPageWrapper>
        <main id="main">
            <DefaultHeroSection>
                <React.Fragment>
                    <h1>Baby monitor with recording</h1>
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
                    <h2 className="text-center">
                        Private and convenient recording
                    </h2>
                    <div className="row mt-4">
                        <div className="col-lg">
                            <div className="card">
                                <div className="card-body">
                                    <h3>
                                        Record without limits
                                    </h3>
                                    <p>
                                        Capture audio and video from your baby
                                        monitor. Record as many videos as you
                                        like, with guaranteed privacy. Your
                                        recordings will appear in your
                                        downloads folder as soon as you stop
                                        recording.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg">
                            <div className="card">
                                <div className="card-body">
                                    <h3>
                                        Guaranteed privacy
                                    </h3>
                                    <p>
                                        Your recordings never leave your device.
                                        Not a single frame is sent outside your
                                        home WiFi.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg">
                            <div className="card">
                                <div className="card-body">
                                    <h3>
                                        Easy to use
                                    </h3>
                                    <p>
                                        Recordings are automatically saved to
                                        your downloads folder. No need to worry
                                        about where to find them.
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
                            <h2>How to record using BeddyBytes</h2>
                            <ol>
                                <li>Select a session from the Parent Station</li>
                                <li>Click on the record button to start recording</li>
                                <li>Click on the record button again to stop recording</li>
                                <li>The recording will be automatically downloaded</li>
                                <li>Open your downloads folder to access the recording</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </section>
            <section className="bg-secondary text-bg-secondary py-5">
                <div className="container">
                    <section>
                        <h2>
                            Capure milestones
                        </h2>
                        <ul>
                            <li>
                                Catch that first successful roll, because one
                                day, they'll be rolling their eyes instead!
                            </li>
                            <li>
                                Record the first time they sit up, because soon
                                they'll be running around the house.
                            </li>
                            <li>
                                Did they just say "mama" or "banana"? Let the
                                family debate begin!
                            </li>
                        </ul>
                    </section>
                    <section className="pt-5">
                        <h2>
                            Replay the funny moments
                        </h2>
                        <ul>
                            <li>
                                That time they were playing peek-a-boo with
                                themselves in the mirror.
                            </li>
                            <li>
                                When they got out of bed and wandered around the
                                room, trying to decide if they should attempt to
                                escape.
                            </li>
                            <li>
                                The first of many impromptu dance parties,
                                captured for future embarrassment.
                            </li>
                        </ul>
                    </section>
                    <section className="pt-5">
                        <h2>
                            Share the recordings
                        </h2>
                        <ul>
                            <li>
                                Show the video to your partner, because they
                                missed it while they were at work.
                            </li>
                            <li>
                                Send the video to the grandparents, because
                                they'll want to see every moment.
                            </li>
                            <li>
                                Compare sleep time antics with friends, because
                                we're all in this together.
                            </li>
                        </ul>
                    </section>
                </div>
            </section>
        </main>
        <FAQSection />
    </DefaultPageWrapper>
)

export default RecordingFeaturePage

export const Head: HeadFC = () => (
    <SEOHead
        title="Baby monitor with recording"
        description="Record and revisit those precious moments when your baby is talking and singing to themselves in their cot."
    />
)