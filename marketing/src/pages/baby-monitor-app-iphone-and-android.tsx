import React from 'react'
import { HeadFC } from 'gatsby'
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
        question: 'Does BeddyBytes really work across iPhone and Android?',
        answer: [
            'Yes. BeddyBytes works in the browser, so you can mix iPhone, Android, tablets, and laptops in the same setup.',
        ],
    },
    {
        question: 'Do I need to buy it separately for each device?',
        answer: [
            'No. One purchase covers your account, and you can use multiple baby stations and parent stations.',
        ],
    },
    {
        question: 'Is there an app in the App Store?',
        answer: [
            'No. BeddyBytes runs in the browser instead of through a native App Store app.',
        ],
    },
    {
        question: 'Does the video go through BeddyBytes servers?',
        answer: [
            'No. BeddyBytes does not relay or store your live media.',
            'The live stream stays on your local network between your own devices.',
        ],
    },
    {
        question: 'Does it still need internet?',
        answer: [
            'Yes. Internet is required to establish the connection between devices, but that traffic is very small.',
            'The live media still stays local.',
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
    name: 'Baby Monitor App for iPhone and Android',
    description: 'Looking for a baby monitor app that works across iPhone and Android? BeddyBytes runs in the browser, uses devices you already own, and keeps live media on your local network.',
    url: 'https://beddybytes.com/baby-monitor-app-iphone-and-android/',
}

const BabyMonitorAppIphoneAndAndroidPage: React.FunctionComponent = () => (
    <UseCasePage>
        <UseCaseHero
            eyebrow="Baby monitor app for iPhone and Android"
            title="Baby monitor app that works across iPhone and Android"
            description="You can use an iPhone as one station and an Android phone as the other. Or mix in tablets and laptops. BeddyBytes runs in the browser, so you are not locked into one device ecosystem."
            visualVariant="landscape"
            visual={(
                <React.Fragment>
                    <div className="use-case-page__visual-card">
                        <StaticImage
                            src="../images/ParentStationLaptop.png"
                            alt="BeddyBytes parent station running on a laptop"
                        />
                    </div>
                    <div className="use-case-page__visual-note">
                        One setup can span iPhone, Android, tablets, and laptops.
                    </div>
                </React.Fragment>
            )}
        />
        <UseCaseTrustBar
            items={[
                'Works across iPhone and Android',
                'One purchase covers all your devices',
                'No subscription',
                '30-day refund, no questions asked',
            ]}
        />
        <UseCaseTextSection
            title="Why this matters in the real world"
            paragraphs={[
                'A lot of baby monitor apps only work well if every device in your house belongs to the same ecosystem. That breaks down pretty quickly for real families.',
                'Maybe your old spare phone is Android, but your main phone is an iPhone. Maybe one parent uses iPhone and the other uses Android. BeddyBytes is built for that reality.',
            ]}
        />
        <UseCaseCardGridSection
            title="How BeddyBytes works across devices"
            items={[
                {
                    title: 'Mix iPhone and Android in one setup',
                    description: 'Use an iPhone as the parent station and an Android phone as the baby station, or flip it around the other way.',
                },
                {
                    title: 'Use tablets and laptops too',
                    description: 'The parent station does not have to live on a phone. A tablet or laptop can fit much better into daily life around the house.',
                },
                {
                    title: 'No App Store lock-in',
                    description: 'BeddyBytes runs through the browser, which is what makes the cross-platform setup practical in the first place.',
                },
                {
                    title: 'Privacy still stays intact',
                    description: 'The live media stays on your local network between your own devices instead of being relayed through BeddyBytes servers.',
                },
            ]}
        />
        <UseCaseHowItWorksSection
            howItWorks={{
                title: 'How you use it',
                steps: [
                    'On the baby-station device, give it a name, choose the microphone, choose the camera, and click start.',
                    'BeddyBytes remembers that setup between sessions.',
                    'On the parent-station device, open the parent station and it connects automatically when a session is available.',
                    'If more than one baby station is available, use the dropdown to switch between them.',
                ],
                note: 'You only need one BeddyBytes account for the whole setup, and you can use multiple baby stations and parent stations.',
            }}
            goodFit={{
                title: 'Probably a good fit if you want',
                items: [
                    'One setup that can span iPhone and Android',
                    'A spare device that does not match your main phone',
                    'A browser-based alternative to App Store-only baby monitor apps',
                    'No subscription sitting underneath the setup',
                    'A practical way to reuse the devices already in your home',
                ],
            }}
        />
        <UseCaseProofSection
            statsLabel="Daily-life proof"
            title="Flexibility is the point"
            quote="BeddyBytes is very easy to use and I love that it's flexible. I can open the parent station on my phone or laptop depending on whether I'm studying or doing housework without lugging around an extra screen."
            attribution="Customer quote from a family using BeddyBytes in daily life."
            quoteLabel="What a customer told me"
            supportingPoints={[
                'The parent station can move with you instead of living on one device',
                'One purchase covers the setup across screens',
                'The cross-platform part matters because real households are mixed',
            ]}
        />
        <UseCaseTradeoffsSection
            title="Things to know before you buy"
            intro="I want this page to help you decide if BeddyBytes is a good fit, so here are the tradeoffs I think are worth being clear about."
            items={[
                {
                    title: 'There is no native App Store app',
                    description: 'BeddyBytes runs in the browser. That is what makes cross-platform support possible, but it is worth stating clearly if you expect something to install from the App Store.',
                },
                {
                    title: 'The baby station uses battery',
                    description: 'The baby-station device uses the camera and microphone continuously, so most families keep it plugged in during use.',
                },
                {
                    title: 'Low-light performance depends on the device',
                    description: 'BeddyBytes uses browser camera controls, so low-light quality depends heavily on the device and browser.',
                },
                {
                    title: 'Internet is required for signaling',
                    description: 'BeddyBytes uses the internet to establish the session between devices, but the amount of internet traffic is very small. The live video and audio still stay on your local network.',
                },
            ]}
        />
        <UseCaseTextSection
            title="BeddyBytes vs single-ecosystem baby monitor apps"
            paragraphs={[
                'Some apps work best only if both devices are on iPhone or both are on Android.',
                'BeddyBytes is for families who want more flexibility than that. If the spare device you want to reuse does not match your main phone, BeddyBytes still fits the way your devices actually look at home.',
            ]}
        />
        <UseCasePricingSection
            title="Use BeddyBytes across iPhone and Android"
            description="One purchase covers all your devices, with yearly and lifetime options and a 30-day refund policy."
        />
        <UseCaseFAQSection items={faqItems} />
        <UseCaseRelatedLinksSection
            links={[
                { label: 'Private baby monitor', to: '/private-baby-monitor/' },
                { label: 'No subscription baby monitor', to: '/no-subscription-baby-monitor/' },
                { label: 'How to turn an old phone into a baby monitor', to: '/how-to-turn-an-old-phone-into-a-baby-monitor/' },
            ]}
        />
    </UseCasePage>
)

export default BabyMonitorAppIphoneAndAndroidPage

export const Head: HeadFC = () => (
    <React.Fragment>
        <SEOHead
            title="Baby Monitor App for iPhone and Android | BeddyBytes"
            description="Looking for a baby monitor app that works across iPhone and Android? BeddyBytes runs in the browser, uses devices you already own, and keeps live media on your local network."
            pathname="/baby-monitor-app-iphone-and-android/"
        />
        <script type="application/ld+json">
            {JSON.stringify(webPageSchema)}
        </script>
        <script type="application/ld+json">
            {JSON.stringify(faqSchema)}
        </script>
    </React.Fragment>
)
