import React, { FunctionComponent } from 'react'
import { type HeadFC } from "gatsby"
import { StaticImage } from 'gatsby-plugin-image'

import DefaultPageWrapper from '../../components/DefaultPageWrapper'
import DemoSection from '../../components/LandingPage/DemoSection'
import PricingSection from '../../components/LandingPage/PricingSection'
import FAQSection from '../../components/LandingPage/FAQSection'
import FeaturesCurrent from '../../components/FeaturesCurrent'
import FeaturesComingSoon from '../../components/FeaturesComingSoon'
import SocialProofSection from '../../components/SocialProof/Section'
import SEOHead from '../../components/SEOHead'
import CallToAction from '../../components/CallToAction'
import promotion from '../../services/promotion'

const PrivateBabyMonitorPage: React.FunctionComponent = () => (
    <DefaultPageWrapper have_pricing_section>
        <div className="landing-page">
            <main id="main">
                <section id="hero">
                    <div className="container">
                        <div className="row align-items-center">
                            <div className="col text-center text-lg-start">
                                <h1>
                                    It's not a myth.
                                    Baby monitors can be private <strong>and</strong> convenient.
                                </h1>
                                <p className="mb-5">
                                    BeddyBytes doesn't send a single frame over the internet.
                                    Video is streamed directly between your smartphone and laptop.
                                </p>
                                <CallToAction
                                    to="#pricing"
                                    color="light"
                                    coupon_code={promotion.code}
                                    discount={promotion.discount}
                                    click_id="cta-hero-section"
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
                <section id="problem">
                    <div className="container">
                        <div className="row align-items-center">
                            <div className="col-md">
                                <h2>
                                    You want a baby monitor, not a video broadcasting service.
                                </h2>
                                <p>
                                    Like us you are probably looking for a baby monitor without WiFi because you're worried about privacy.
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
                            <div className="d-none d-xl-block col-xl-auto text-center">
                                <ProblemFlowDiagramLandscape />
                            </div>
                            <div className="col-md-auto d-xl-none text-center">
                                <ProblemFlowDiagramPortrait />
                            </div>
                        </div>
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
            </main >
            <DemoSection />
            <SocialProofSection />
            <PricingSection />
            <FAQSection />
        </div>
    </DefaultPageWrapper>
)

export default PrivateBabyMonitorPage

export const Head: HeadFC = () => <SEOHead title="Private Baby Monitor - BeddyBytes" description="BeddyBytes is a private baby monitor that streams video directly between your devices" pathname="/baby-monitor-without-wifi/" />

const ProblemFlowDiagramLandscape = () => (
    <svg viewBox="0 0 170 80" width={500}>
        <text x={9} y={40}>🎥</text>
        <text x={7} y={56} fontSize={6}>Use wifi</text>
        <text x={0} y={62} fontSize={6}>baby monitor</text>

        <CurvedArrow x={20} y={15} width={60} />

        <text x={75} y={40}>💭</text>
        <text x={72} y={56} fontSize={6}>Data sent</text>
        <text x={74} y={62} fontSize={6}>to cloud</text>

        <CurvedArrow x={95} y={-55} width={60} transform="scale(1, -1)" />

        <text x={150} y={40}>🔓</text>
        <text x={148} y={56} fontSize={6}>Security</text>
        <text x={150} y={62} fontSize={6}>breach</text>
    </svg>
)

const CurvedArrow: FunctionComponent<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 200 120" stroke="black" width={40} height={24} strokeWidth={4} {...props}>
        <path d="M 20 60 Q 100 20 180 60" fill="transparent" />
        <g transform="rotate(25, 180, 60)">
            <path d="M 180 59 L 160 80" fill="transparent" />
            <path d="M 180 61 L 160 40" fill="transparent" />
        </g>
    </svg>
)

const ProblemFlowDiagramPortrait: FunctionComponent = () => (
    <svg viewBox="0 0 100 300" width={200}>
        <text x={46} y={40}>🎥</text>
        <text x={44} y={56} fontSize={6}>Use wifi</text>
        <text x={38} y={62} fontSize={6}>baby monitor</text>

        <CurvedArrow x={80} y={65} width={60} transform="rotate(90, 80, 65)" />

        <text x={46} y={140}>💭</text>
        <text x={42} y={156} fontSize={6}>Data sent</text>
        <text x={44} y={162} fontSize={6}>to cloud</text>

        <CurvedArrow x={32} y={-165} width={60} transform="rotate(90, 32, 165) scale(1, -1)" />

        <text x={46} y={240}>🔓</text>
        <text x={44} y={256} fontSize={6}>Security</text>
        <text x={46} y={262} fontSize={6}>breach</text>
    </svg>
)
