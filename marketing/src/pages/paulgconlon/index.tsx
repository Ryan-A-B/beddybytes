import React from 'react'
import type { HeadFC } from "gatsby"
import { StaticImage } from 'gatsby-plugin-image'
import SEOHead from '../../components/SEOHead'
import DefaultPageWrapper from '../../components/DefaultPageWrapper'
import FAQSection from '../../components/LandingPage/FAQSection'
import Features from '../../components/Features'
import PricingSection from '../../components/LandingPage/PricingSection'
import DemoSection from '../../components/LandingPage/DemoSection'
import SocialProofSection from '../../components/SocialProof/Section'
import CallToAction from '../../components/CallToAction'

import "./style.scss"

const CitizenOneLink: React.FunctionComponent = () => <a href="https://paulgconlon.com" target="_blank" className="link-secondary">Citizen One</a>

const PaulGConlon = () => (
    <DefaultPageWrapper without_call_to_action>
        <div id="paulgconlon" className="landing-page">
            <main>
                <section className="bg-primary text-bg-primary py-5">
                    <div className="container ">
                        <div className="row align-items-center">
                            <div className="order-md-2 d-md-block col-md col-lg-5 col-xl-4">
                                <StaticImage
                                    src="../../images/CitizenOne.png"
                                    alt="Citizen One"
                                    className="img-fluid"
                                />
                            </div>
                            <div className="col text-center">
                                <h1>Privacy with BeddyBytes and Citizen One</h1>
                                <h5>Celebrate Privacy with BeddyBytes and <CitizenOneLink /></h5>
                                <p>
                                    BeddyBytes transforms your smartphone and laptop into a private and convenient baby monitor.
                                    BeddyBytes won't send a single frame of video over the internet.
                                    We keep your data safe by never handling it in the first place.
                                </p>
                                <CallToAction
                                    color="light"
                                    click_id="cta-hero-section"
                                />
                            </div>
                        </div>
                    </div>
                </section>
                <section id="problem">
                    <div className="container">
                        <h2>You want a baby monitor, not a video broadcasting service.</h2>
                        <p>
                            As parents, we cherish every moment with our little ones and strive to protect their
                            future. Yet it's hard for many to grasp that digital protection is now every bit as
                            important as physical protection.
                        </p>
                        <h6>Why's that?</h6>
                        <p>
                            It's a complex question that now has a simple answer. With the release of the
                            thought-provoking book, Citizen One, fellow engineer Paul G Conlon makes an
                            excellent case for taking your children's digital presence seriously - starting now!
                        </p>
                    </div>
                </section>
                <section id="solution">
                    <div className="container">
                        <div className="row align-items-center">
                            <div className="col-md">
                                <h4>What can Citizen One do for me?</h4>
                                <p>
                                    Citizen One reveals the dangers of digital identification and the importance of online
                                    anonymity. It draws chilling parallels between historical identity harvesting and
                                    modern surveillance, emphasising how protecting personal data starts at home.
                                </p>
                                <h4>How can BeddyBytes help?</h4>
                                <p>
                                    In a world where digital privacy is increasingly compromised, BeddyBytes transforms
                                    your smartphone and laptop into a secure baby monitor, ensuring that images never
                                    leave your devices. With BeddyBytes, your family's digital privacy is our top priority -
                                    because we use it for ours.
                                </p>
                                <p>
                                    Ready to take control of the cameras that watch over you?
                                </p>
                                <p>
                                    With Citizen One, you will understand why digital privacy matters, and with
                                    BeddyBytes you can do something about it.
                                </p>
                                <p>
                                    Gifting your children a clean digital slate as they enter adulthood is maybe the most
                                    profoundly valuable gift parents can now bequeath.
                                    Join the privacy renaissance and do something today your children will thank you for
                                    tomorrow.
                                </p>
                                <CallToAction
                                    color="light"
                                    click_id="cta-solution-section"
                                />
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
            </main>
            <Features backgroundClassName="bg-tertiary">
                <h2>Features</h2>
            </Features>
            <PricingSection variant="purple" />
            <DemoSection />
            <SocialProofSection />
            <FAQSection />
            <section className="bg-primary text-light py-5">
                <div className="container text-center">
                    <h2>Get started today</h2>
                    <CallToAction
                        color="light"
                        click_id="cta-cta-section"
                    />
                </div>
            </section>
        </div>
    </DefaultPageWrapper>
)

export default PaulGConlon

export const Head: HeadFC = () => (
    <SEOHead
        title="Citizen One - BeddyBytes"
        description="Celebrate Privacy with BeddyBytes and Citizen One"
        pathname="/paulgconlon/"
        noindex
    />
)
