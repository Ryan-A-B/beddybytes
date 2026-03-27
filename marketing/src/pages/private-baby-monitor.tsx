import React from 'react'
import { HeadFC, Link } from 'gatsby'
import { StaticImage } from 'gatsby-plugin-image'
import SEOHead from '../components/SEOHead'
import {
    UseCaseCardGridSection,
    UseCaseFAQSection,
    UseCaseHero,
    UseCaseHowItWorksSection,
    UseCasePage,
    UseCasePricingSection,
    UseCaseProofSection,
    UseCaseRelatedLinksSection,
    UseCaseTextSection,
    UseCaseTradeoffsSection,
    UseCaseTrustBar,
} from '../components/UseCaseLandingPage'

const faqItems = [
    {
        question: 'Do I need to buy BeddyBytes for each device?',
        answer: [
            'No. One purchase covers your account, and you can use multiple baby stations and parent stations on that account.',
        ],
    },
    {
        question: 'Does BeddyBytes store my baby video on your servers?',
        answer: [
            'No. BeddyBytes does not store your live baby monitor video or audio, and it does not relay that media through its servers.',
            'The live stream stays on your local network between your own devices.',
        ],
    },
    {
        question: 'Does it work across iPhone and Android?',
        answer: [
            'Yes. BeddyBytes runs in the browser, so you can mix iPhone, Android, tablets, and laptops in the same setup.',
        ],
    },
    {
        question: 'Does it need Wi-Fi?',
        answer: [
            'Yes. BeddyBytes is designed for local-network use, so your devices need to be able to reach each other on the same network.',
            'An internet connection is still required to establish the session because BeddyBytes uses signaling to connect your devices. That internet usage is very small, and the live media still stays on your local network.',
        ],
    },
    {
        question: 'Is there a free trial?',
        answer: [
            'No. There is no free trial, but every purchase is covered by a 30-day refund policy, no questions asked.',
        ],
    },
    {
        question: 'Is this better than a radio baby monitor?',
        answer: [
            'Yes, for some families. Radio baby monitors are simpler, and some parents will prefer that.',
            'BeddyBytes is for parents who want the convenience of a smart monitor while still keeping the live stream between their own devices instead of sending it through a cloud service or central relay.',
        ],
    },
]

const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer.join(' '),
        },
    })),
}

const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Private Baby Monitor That Uses Devices You Already Own',
    description: 'Turn your old phone, tablet, or laptop into a private baby monitor. No subscription. Works across iPhone and Android. Live video and audio stay on your local network.',
    url: 'https://beddybytes.com/private-baby-monitor/',
}

const PrivateBabyMonitorPage: React.FunctionComponent = () => (
    <UseCasePage>
        <UseCaseHero
            eyebrow="Private baby monitor"
            title="Private baby monitor that uses devices you already own"
            description="If you already have an old phone, tablet, or laptop, BeddyBytes turns it into a private baby monitor in minutes. You do not need extra monitor hardware, and your live video and audio stay on your local network."
            visualVariant="portrait"
            visual={(
                <React.Fragment>
                    <div className="use-case-page__visual-card">
                        <StaticImage
                            src="../images/BabyStationRunning.jpg"
                            alt="phone running the BeddyBytes baby station"
                        />
                    </div>
                    <div className="use-case-page__visual-note">
                        No cloud video relay. The internet is only used to establish the connection.
                    </div>
                </React.Fragment>
            )}
        />
        <UseCaseTrustBar
            items={[
                'No subscription',
                'One purchase covers all your devices',
                'Works across iPhone and Android',
                '30-day refund, no questions asked',
            ]}
        />
        <UseCaseTextSection
            title="Why people end up here"
            paragraphs={[
                'Most people looking for a private baby monitor are trying to solve two problems at once. They want something practical enough to use every day, and they do not want live baby video going through someone else\'s servers.',
                'That is exactly what BeddyBytes is for. It gives the devices you already own a second life as a baby monitor, without pushing you toward dedicated hardware or a monthly subscription.',
            ]}
        />
        <UseCaseCardGridSection
            title="Why BeddyBytes feels different"
            items={[
                {
                    title: 'No cloud video relay',
                    description: 'Your live video and audio stay between your own devices on your local network instead of passing through BeddyBytes servers.',
                },
                {
                    title: 'No subscription',
                    description: (
                        <React.Fragment>
                            Pay once for access and stop thinking about monthly baby monitor fees. If recurring fees are the main thing you are trying to avoid, see the full <Link to="/no-subscription-baby-monitor/">no subscription baby monitor</Link> page.
                        </React.Fragment>
                    ),
                },
                {
                    title: 'Reuse the devices you already own',
                    description: (
                        <React.Fragment>
                            Use a spare phone, tablet, or laptop as the baby station instead of buying another camera for the nursery. If you already have a spare handset ready to go, here is how to <Link to="/how-to-turn-an-old-phone-into-a-baby-monitor/">turn an old phone into a baby monitor</Link>.
                        </React.Fragment>
                    ),
                },
                {
                    title: 'Works across the devices already in your home',
                    description: (
                        <React.Fragment>
                            BeddyBytes works across iPhone, Android, tablets, and laptops through the browser, so it fits the mix of devices most families already have at home. For mixed-device households, this <Link to="/baby-monitor-app-iphone-and-android/">baby monitor app for iPhone and Android</Link> page explains how the setup works.
                        </React.Fragment>
                    ),
                },
            ]}
        />
        <UseCaseHowItWorksSection
            howItWorks={{
                title: 'How you actually use it',
                steps: [
                    'On the baby-station device, give it a name, pick the microphone, pick the camera, and click start.',
                    'BeddyBytes remembers that setup, so you do not need to repeat it every time.',
                    'On the parent-station device, open the parent station and it connects automatically when a session is available.',
                    'If you have more than one baby station, use the dropdown to switch between them.',
                ],
                note: 'You only buy BeddyBytes once for your account, and there is no limit on how many baby stations or parent stations can be active at the same time.',
            }}
            goodFit={{
                title: 'Probably a good fit if you want',
                items: [
                    'A private baby monitor without buying more hardware',
                    'No subscription hanging over a simple daily tool',
                    'A spare phone or tablet that can get a second life',
                    'A setup that works across iPhone, Android, tablets, and laptops',
                    'Something useful for naps, evenings, working from home, and travel',
                ],
            }}
        />
        <UseCaseProofSection
            statsLabel="Real-world use"
            title="20,000+ hours monitored"
            quote="BeddyBytes is very easy to use and I love that it's flexible. I can open the parent station on my phone or laptop depending on whether I'm studying or doing housework without lugging around an extra screen. Knowing that images of our family life are completely private is very reassuring too."
            attribution="Customer quote from a family using BeddyBytes as part of daily life."
            quoteLabel="What a customer told me"
            supportingPoints={[
                'The flexibility matters in daily life, not just during setup',
                'Privacy is reassuring because the live media path stays local',
                'One purchase covers the whole household setup',
            ]}
        />
        <UseCaseTradeoffsSection
            title="Things to know before you buy"
            intro="I want this page to help you decide if BeddyBytes is a good fit, so here are the tradeoffs I think are worth being clear about."
            items={[
                {
                    title: 'The baby station uses battery',
                    description: 'The device acting as the baby station runs the camera and microphone continuously, so battery drain is higher than normal. Most families keep that device plugged in while using BeddyBytes.',
                },
                {
                    title: 'Low light depends on the device',
                    description: 'BeddyBytes uses the camera controls available in the browser. In dim rooms, results depend heavily on the phone camera and browser, so some parents use audio-only monitoring at night or add a low-level light.',
                },
                {
                    title: 'There is no App Store app',
                    description: 'BeddyBytes runs in the browser. That is part of why it works across different devices without locking you into one app ecosystem.',
                },
                {
                    title: 'Internet is still required for signaling',
                    description: 'BeddyBytes uses the internet to establish the session between devices, but that traffic is very small, on the order of tens of kilobytes. The live media still stays on your local network.',
                },
            ]}
        />
        <UseCaseTextSection
            title="BeddyBytes vs cloud baby monitors"
            paragraphs={[
                'If you care about privacy, I do not think the real question is simply whether a monitor uses Wi-Fi. The more useful question is where the live video and audio go once the session starts.',
                'With BeddyBytes, the live stream stays between your own devices on your local network instead of being relayed through a cloud camera service. That is the whole point of the product.',
            ]}
        />
        <UseCasePricingSection
            title="See pricing and try BeddyBytes at home"
            description="One purchase covers your account across all your devices. If it is not a fit at home, there is a 30-day refund policy."
        />
        <UseCaseFAQSection items={faqItems} />
        <UseCaseRelatedLinksSection
            links={[
                { label: 'No subscription baby monitor', to: '/no-subscription-baby-monitor/' },
                { label: 'Baby monitor app for iPhone and Android', to: '/baby-monitor-app-iphone-and-android/' },
                { label: 'How to turn an old phone into a baby monitor', to: '/how-to-turn-an-old-phone-into-a-baby-monitor/' },
                { label: 'Radio baby monitor vs Wi-Fi baby monitor', to: '/radio-baby-monitor-vs-wifi-baby-monitor/' },
            ]}
        />
    </UseCasePage>
)

export default PrivateBabyMonitorPage

export const Head: HeadFC = () => (
    <React.Fragment>
        <SEOHead
            title="Private Baby Monitor | No Subscription | BeddyBytes"
            description="Turn your old phone, tablet, or laptop into a private baby monitor. No subscription. Works across iPhone and Android. Live video and audio stay on your local network."
            pathname="/private-baby-monitor/"
        />
        <script type="application/ld+json">
            {JSON.stringify(webPageSchema)}
        </script>
        <script type="application/ld+json">
            {JSON.stringify(faqSchema)}
        </script>
    </React.Fragment>
)
