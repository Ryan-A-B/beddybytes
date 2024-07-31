import React from 'react'
import type { HeadFC } from "gatsby"
import { StaticImage } from 'gatsby-plugin-image'
import DefaultPageWrapper from '../../components/DefaultPageWrapper'
import FeaturesCurrent from '../../components/FeaturesCurrent'
import FeaturesComingSoon from '../../components/FeaturesComingSoon'
import CallToAction from './CallToAction'
import DemoSection from '../../components/LandingPage/DemoSection'
import SocialProofSection from '../../components/SocialProof/Section'
import FAQSection from '../../components/LandingPage/FAQSection'

const CitizenOneLink: React.FunctionComponent = () => <a href="https://paulgconlon.com" target="_blank" className="link-secondary">Citizen One</a>

const PaulGConlon = () => (
    <DefaultPageWrapper without_call_to_action_section>
        <div className="landing-page">
            <main >
                <section className="bg-primary text-bg-primary py-5">
                    <div className="container ">
                        <div className="row align-items-center">
                            <div className="col text-center">
                                <h1 >Welcome my freedom loving friends!</h1>
                                <p>
                                    As we eagerly await the release of <CitizenOneLink />, I'm excited to share with you a special offer from BeddyBytes.
                                    BeddyBytes transforms your smartphone and laptop into a private and convenient baby monitor.
                                    BeddyBytes won't send a single frame of video over the internet.
                                    We keep your data safe by never handling it in the first place.
                                </p>
                                <CallToAction />
                            </div>
                            <div className="d-none d-md-block col-md col-lg-5 col-xl-4">
                                <StaticImage
                                    src="../../images/ParentStationLaptop.png"
                                    alt="laptop parent station"
                                    className="img-fluid"
                                />
                            </div>
                        </div>
                    </div>
                </section>
                <section id="problem">
                    <div className="container">
                        <h2>
                            You want a baby monitor, not a video broadcasting service.
                        </h2>
                        <p>
                            Like us you are probably looking for a baby monitor that cares as much about privacy as you do.
                            If you've read a few privacy policies you'll know that most baby monitors which connect to the cloud are creepy at best.
                            And, even if the privacy policy checks out, data leaks and breaches happen all the time.
                        </p>
                        <section>
                            <h3>Privacy red flags</h3>
                            <p>While it's possible to provide the following features while maintaining privacy, most companies don't.</p>
                            <ul>
                                <li>AI features: companies use your data to train their models</li>
                                <li>Remote viewing: your video is quite likely passing through somebody else's server</li>
                                <li>Recording: your video is probably being stored remotely</li>
                            </ul>
                        </section>
                    </div>
                </section>
                <section id="solution">
                    <div className="container">
                        <h2>
                            Keep your data at home using our baby monitor web app.
                        </h2>
                        <p>
                            The best way to keep your data private is to never give it out in the first place.
                            We stream nap time directly between your smartphone and laptop using your home WiFi.
                        </p>
                        <p>
                            An internet connection is required to establish the connection between devices. But no video is sent over the internet.
                        </p>
                        <section>
                            <h3>Features</h3>
                            <div className="row">
                                <div className="col-md">
                                    <FeaturesCurrent />
                                </div>
                                <div className="col-md">
                                    <FeaturesComingSoon />
                                </div>
                            </div>
                        </section>
                    </div>
                </section>
            </main>
            <DemoSection />
            <SocialProofSection />
            <FAQSection />
            <section className="bg-primary text-light py-5">
                <div className="container text-center">
                    <h2>Get started today</h2>
                    <CallToAction />
                </div>
            </section>
        </div>
    </DefaultPageWrapper>
)

export default PaulGConlon

export const Head: HeadFC = () => <title>BeddyBytes</title>