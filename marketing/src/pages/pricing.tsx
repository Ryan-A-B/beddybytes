import React from "react"
import { Link, type HeadFC, type PageProps } from "gatsby"
import { StaticImage } from "gatsby-plugin-image"
import SEOHead from "../components/SEOHead"
import DefaultPageWrapper from "../components/DefaultPageWrapper"
import Pricing from "../components/Pricing"
import SocialProofSection from "../components/SocialProof/Section"
import AllPlansInclude from "../components/Pricing/AllPlansInclude"
import { OnePurchase, RedirectToPaymentProcessor } from "../components/Pricing/Messages"
import FAQSection, { FAQItem, faqLibrary } from "../components/LandingPage/FAQSection"

const pricingFAQItems: FAQItem[] = [
    {
        question: "Will this work on the devices I already own?",
        answer: (
            <React.Fragment>
                <p>
                    Usually yes if your devices support a modern browser with WebRTC and WebSockets.
                    The fastest way to know is to run the <Link to="/compatibility/">compatibility checker</Link>
                    on the devices you plan to use before you buy.
                </p>
                <p>
                    Baby Station devices need a camera and microphone. Parent Station devices only need
                    browser support for WebRTC and WebSockets.
                </p>
            </React.Fragment>
        ),
    },
    {
        question: "How hard is setup?",
        answer: (
            <React.Fragment>
                <p>
                    Setup is designed to take a few minutes: sign in, open Baby Station on one device,
                    open Parent Station on another, and allow camera and microphone access.
                </p>
                <p>
                    Watch the <Link to="/#demo">setup video</Link> if you want to see the flow before purchasing.
                </p>
            </React.Fragment>
        ),
    },
    {
        question: "What happens after I buy?",
        answer: (
            <React.Fragment>
                <p>
                    Checkout is handled on a secure Stripe-hosted payment page. After purchase, your account
                    can be used across your compatible devices without paying per device.
                </p>
                <p>
                    The product is browser-based, so there is no app-store install step to discover after payment.
                </p>
            </React.Fragment>
        ),
    },
    {
        question: "What if it is not a fit for our setup?",
        answer: (
            <React.Fragment>
                <p>
                    Every plan includes a <strong>30-day refund guarantee</strong>.
                </p>
                <p>
                    The safest path is still to check compatibility first so you know your intended devices
                    support the required browser features.
                </p>
            </React.Fragment>
        ),
    },
    faqLibrary.internetConnection,
]

const PricingPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper without_call_to_action>
            <main id="page-pricing" className="bg-primary text-bg-primary py-5">
                <div className="container">
                    <h1 className="text-center mt-3">One-time purchase baby monitor pricing</h1>
                    <p className="fs-5 text-center">Simple. Private. Yours.</p>
                    <p className="text-center">
                        Choose a one-time purchase plan with no subscription and
                        access BeddyBytes across all your devices.
                    </p>
                    <div className="alert alert-light text-dark border-0 mb-4">
                        <div className="row g-3 align-items-center">
                            <div className="col-lg-8">
                                <h2 className="h4">Check compatibility before you buy</h2>
                                <p className="mb-3">
                                    Most purchase hesitation comes down to setup confidence and device compatibility.
                                    Run the browser-based compatibility check, watch the setup flow, then come back to buy.
                                </p>
                                <div className="d-grid gap-2 d-sm-flex">
                                    <Link to="/compatibility/" className="btn btn-primary">
                                        Check compatibility
                                    </Link>
                                    <Link to="/#demo" className="btn btn-outline-primary">
                                        Watch setup video
                                    </Link>
                                </div>
                            </div>
                            <div className="col-lg-4">
                                <ul className="list-unstyled small mb-0">
                                    <li className="mb-2">Uses your existing phones, tablets, and laptops.</li>
                                    <li className="mb-2">Internet is used for signalling. Media stays local between your devices.</li>
                                    <li><strong>30-day refund guarantee</strong> if it is not the right fit.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <section className="row g-3 mb-4">
                        <div className="col-md-6">
                            <article className="card h-100 border-0 shadow-sm text-dark">
                                <StaticImage
                                    src="../images/BabyStationRunning.jpg"
                                    alt="BeddyBytes Baby Station running on a phone"
                                    aspectRatio={16 / 9}
                                />
                                <div className="card-body">
                                    <h2 className="h5">What the Baby Station looks like</h2>
                                    <p className="mb-0">Use a phone or tablet near the cot and keep it plugged in for longer sessions.</p>
                                </div>
                            </article>
                        </div>
                        <div className="col-md-6">
                            <article className="card h-100 border-0 shadow-sm text-dark">
                                <StaticImage
                                    src="../images/ParentStationLaptop.png"
                                    alt="BeddyBytes Parent Station monitoring on a laptop"
                                    aspectRatio={4 / 3}
                                    transformOptions={{ fit: "contain" }}
                                />
                                <div className="card-body">
                                    <h2 className="h5">What the Parent Station looks like</h2>
                                    <p className="mb-0">Monitor from the device you are already using, whether that is a phone, tablet, or laptop.</p>
                                </div>
                            </article>
                        </div>
                    </section>
                    <div className="bg-light text-bg-light p-3 rounded">
                        <AllPlansInclude />
                        <Pricing />
                        <OnePurchase />
                        <RedirectToPaymentProcessor />
                    </div>
                </div>
            </main>
            <SocialProofSection />
            <FAQSection items={pricingFAQItems} />
        </DefaultPageWrapper>
    )
}

export default PricingPage

export const Head: HeadFC = () => (
    <SEOHead
        title="BeddyBytes Pricing | One-Time Purchase Baby Monitor"
        description="One-time purchase baby monitor pricing from BeddyBytes. No subscription, unlimited stations, and a 30-day refund guarantee."
        pathname="/pricing/"
    />
)
