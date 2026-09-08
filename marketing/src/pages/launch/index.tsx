import React from 'react'
import { HeadFC, Link } from 'gatsby'
import DefaultPageWrapper from '../../components/DefaultPageWrapper'
import SEOHead from '../../components/SEOHead'
import CallToActionSection from '../../components/CallToActionSection'
import GoodFitSection from '../../components/GoodFitSection'
import FAQSection, { FAQItem } from '../../components/LandingPage/FAQSection'
import PricingSection from '../../components/LandingPage/PricingSection'
import TrustSection from '../../components/TrustSection'
import { UseCaseProofSection } from '../../components/UseCaseLandingPage'
import useOnClick from '../../hooks/useOnClick'

import './style.scss'

const launchFAQItems: FAQItem[] = [
    {
        question: 'What do I need to use BeddyBytes?',
        answer: (
            <p>
                You need two supported devices on the same home network. Use one near your baby as
                the Baby Station and another phone, tablet or laptop as the Parent Station.
            </p>
        ),
    },
    {
        question: 'Do I need to buy extra baby monitor hardware?',
        answer: (
            <p>
                No. BeddyBytes is designed to use devices you already own, such as a spare phone,
                tablet or laptop.
            </p>
        ),
    },
    {
        question: 'Does my baby video leave my home network?',
        answer: (
            <p>
                No. Live video and audio stream directly between your devices over your home
                network. BeddyBytes uses its backend for account login and connection setup, but it
                does not relay or store your live media.
            </p>
        ),
    },
    {
        question: 'Why does BeddyBytes still need an internet connection?',
        answer: (
            <p>
                The internet is used to introduce your devices and establish the session. Once
                connected, the live video and audio stay between your devices on your local network.
            </p>
        ),
    },
    {
        question: 'Do I need to purchase BeddyBytes for every device?',
        answer: (
            <p>
                No. One purchase covers your account, so you can use BeddyBytes across the phones,
                tablets and laptops in your household.
            </p>
        ),
    },
    {
        question: 'Can I monitor when I am away from home?',
        answer: (
            <p>
                No. BeddyBytes is built for monitoring while both devices are on the same home
                network. It does not provide out-of-home viewing.
            </p>
        ),
    },
    {
        question: 'What if BeddyBytes is not right for my setup?',
        answer: (
            <p>
                Every purchase is covered by a 30-day money-back guarantee, so you can try it with
                the devices and network you use at home.
            </p>
        ),
    },
]

const LaunchPage: React.FunctionComponent = () => {
    const onHeroCtaClick = useOnClick('cta-launch-hero')

    return (
        <DefaultPageWrapper without_call_to_action>
            <main id="main" className="launch-page">
                <section className="launch-page__hero page-bands">
                    <div className="container">
                        <div className="row align-items-center gy-5 gx-0 gx-lg-5">
                            <div className="col-lg-6">
                                <div className="launch-page__proof-badge">
                                    <strong>20,000+ hours monitored across 60+ families</strong>
                                    <span>As of August 2026</span>
                                </div>

                                <h1>
                                    <span>Monitor your baby.</span>
                                    <span>No new hardware required.</span>
                                </h1>

                                <p className="launch-page__hero-copy">
                                    A simple, private baby monitor that lets you get on with your day.
                                    Wash the dishes. Fold the laundry. Drink your coffee while it&apos;s
                                    still hot. BeddyBytes keeps your little one close.
                                </p>

                                <div className="launch-page__hero-action">
                                    <Link
                                        to="#pricing"
                                        className="launch-page__primary-button"
                                        onClick={onHeroCtaClick}
                                    >
                                        Get BeddyBytes
                                    </Link>
                                    <p>
                                        One purchase works across all your devices.
                                        <span>30-day money-back guarantee.</span>
                                    </p>
                                </div>
                            </div>

                            <div className="col-lg-6">
                                <div className="launch-page__video-frame">
                                    <video
                                        autoPlay
                                        controls
                                        loop
                                        muted
                                        playsInline
                                        poster="/images/launch-video-poster.png"
                                        preload="metadata"
                                        aria-label="How BeddyBytes turns devices you already own into a baby monitor"
                                    >
                                        <source
                                            src="/videos/beddybytes-introduction.mp4"
                                            type="video/mp4"
                                        />
                                    </video>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="launch-page__setup page-bands">
                    <div className="container">
                        <div className="launch-page__section-heading">
                            <h2>Start monitoring in minutes.</h2>
                            <p>
                                Use devices you already own. Use one device as the Baby Station and another as the Parent
                                Station. Both run in the browser and connect over your home network.
                            </p>
                        </div>

                        <ol className="launch-page__steps">
                            <li>
                                <span className="launch-page__step-number" aria-hidden="true">1</span>
                                <div>
                                    <h3>Set up the Baby Station</h3>
                                    <p>
                                        Open BeddyBytes on a phone near your baby. Choose the
                                        microphone and camera, then start monitoring.
                                    </p>
                                </div>
                            </li>
                            <li>
                                <span className="launch-page__step-number" aria-hidden="true">2</span>
                                <div>
                                    <h3>Open the Parent Station</h3>
                                    <p>
                                        Watch and listen from another phone, tablet or laptop
                                        elsewhere in your home.
                                    </p>
                                </div>
                            </li>
                            <li>
                                <span className="launch-page__step-number" aria-hidden="true">3</span>
                                <div>
                                    <h3>Keep the stream at home</h3>
                                    <p>
                                        Live video and audio travel between your devices over your
                                        home network. They are never relayed through BeddyBytes
                                        servers.
                                    </p>
                                </div>
                            </li>
                        </ol>

                        <p className="launch-page__requirements">
                            Requires two supported devices on the same home network and an internet
                            connection to establish the session.
                        </p>
                    </div>
                </section>

                <TrustSection className="page-bands" />

                <GoodFitSection className="page-bands" />

                <UseCaseProofSection
                    statsLabel="Real-world use"
                    title="20,000+ hours monitored"
                    quote="BeddyBytes is very easy to use and I love that it's flexible. I can open the parent station on my phone or laptop depending on whether I'm studying or doing housework without lugging around an extra screen. Knowing that images of our family life are completely private is very reassuring too."
                    attribution="Customer quote from a family using BeddyBytes as part of daily life."
                    quoteLabel="What a customer told me"
                    supportingPoints={[
                        'The parent station works across the devices families already use',
                        'The flexibility fits normal routines around the house',
                        'Local media streaming keeps family life private',
                    ]}
                    className="page-bands"
                />

                <PricingSection className="page-bands" />

                <FAQSection items={launchFAQItems} className="page-bands" />

                <CallToActionSection to="#pricing" className="page-bands" label="Get BeddyBytes" />
            </main>
        </DefaultPageWrapper>
    )
}

export default LaunchPage

export const Head: HeadFC = () => (
    <SEOHead
        title="BeddyBytes | A Baby Monitor Using Devices You Already Own"
        description="Turn devices you already own into a simple, private baby monitor. Live video stays on your home network, with no new hardware required."
        noindex
        pathname="/launch/"
    />
)
