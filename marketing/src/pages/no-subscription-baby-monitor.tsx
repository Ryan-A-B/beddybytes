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
        question: 'Is BeddyBytes the best baby monitor without subscription for everyone?',
        answer: [
            'No. It is best for families who want to reuse devices they already own and avoid recurring fees. If someone wants a dedicated hardware monitor with its own camera and screen in the box, they should buy that instead.',
        ],
    },
    {
        question: 'Is BeddyBytes really a no subscription baby monitor?',
        answer: [
            'Yes. BeddyBytes is sold as access, not as an ongoing monthly subscription.',
        ],
    },
    {
        question: 'Do I need to buy it more than once for multiple devices?',
        answer: [
            'No. One purchase covers your account, and you can use multiple baby and parent stations on that account.',
        ],
    },
    {
        question: 'Does it work across iPhone and Android?',
        answer: [
            'Yes. BeddyBytes works across iPhone, Android, tablets, and laptops through the browser.',
        ],
    },
    {
        question: 'Do I need to buy extra hardware?',
        answer: [
            'No. BeddyBytes is designed to work with devices you already own.',
        ],
    },
    {
        question: 'Is there a free trial?',
        answer: [
            'No. There is no free trial, but there is a 30-day refund policy, no questions asked.',
        ],
    },
    {
        question: 'Does BeddyBytes store my baby video?',
        answer: [
            'No. BeddyBytes does not store your live baby monitor video or audio, and it does not relay that media through its servers.',
        ],
    },
    {
        question: 'Does it still need internet?',
        answer: [
            'Yes, but only to establish the connection between your devices.',
            'BeddyBytes uses the backend for signaling, which is a very small amount of internet traffic. The live media itself stays on your local network.',
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
    name: 'Best Baby Monitor Without Subscription? A No Subscription Option That Uses Devices You Already Own',
    description: 'Looking for the best baby monitor without subscription fees? BeddyBytes turns your old phone, tablet, or laptop into a baby monitor with one purchase for all your devices.',
    url: 'https://beddybytes.com/no-subscription-baby-monitor/',
}

const NoSubscriptionBabyMonitorPage: React.FunctionComponent = () => (
    <UseCasePage>
        <UseCaseHero
            eyebrow="No subscription baby monitor"
            title="Best baby monitor without subscription if you already own the devices"
            description="If you are trying to avoid another monthly baby-tech bill, BeddyBytes gives the devices you already own a second life as a baby monitor. You buy access once and use it across your devices."
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
                        One purchase covers your account across phones, tablets, and laptops.
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
            title="Why subscription baby monitors put people off"
            paragraphs={[
                'Too many modern baby monitors come with two price tags. First you buy the hardware. Then you keep paying every month for the features that make the product feel complete.',
                'I built BeddyBytes for parents who want the convenience of a smart baby monitor without turning it into another subscription sitting on the family budget.',
            ]}
        />
        <UseCaseCardGridSection
            title="Why BeddyBytes Can Be The Best Baby Monitor Without Subscription"
            items={[
                {
                    title: 'One purchase instead of recurring fees',
                    description: 'BeddyBytes is for families who want to pay once for access instead of adding another monthly charge to a daily tool.',
                },
                {
                    title: 'No extra hardware if you already have devices',
                    description: 'If you already have a spare phone, tablet, or laptop, you may already own most of what you need for the setup.',
                },
                {
                    title: 'iPhone and Android in the same setup',
                    description: 'BeddyBytes works across iPhone, Android, tablets, and laptops through the browser, so mixed-device households are not boxed into one ecosystem.',
                },
                {
                    title: 'Live media stays between your own devices',
                    description: 'BeddyBytes does not relay or store your live media, so the live stream stays between your own devices on your local network.',
                },
                {
                    title: 'Not the best fit for every family',
                    description: 'If you want a dedicated camera and bundled parent unit out of the box, you should buy that instead. BeddyBytes is strongest when you already own the devices and want to reuse them.',
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
                    'If you have more than one baby station, use the dropdown to switch between them.',
                ],
                note: 'You only need one BeddyBytes account, and there is no limit on how many baby stations or parent stations can be active at the same time.',
            }}
            goodFit={{
                title: 'Probably a good fit if you want',
                items: [
                    'A smart baby monitor without a subscription',
                    'A setup built from devices you already own',
                    'Something that works across iPhone, Android, tablets, and laptops',
                    'A practical option for naps, evenings, and travel',
                    'A simpler long-term cost than hardware-plus-subscription products',
                ],
            }}
        />
        <UseCaseProofSection
            statsLabel="Why this matters"
            title="The cost stays simple"
            quote="BeddyBytes is very easy to use and I love that it's flexible. I can open the parent station on my phone or laptop depending on whether I'm studying or doing housework without lugging around an extra screen. Knowing that images of our family life are completely private is very reassuring too."
            attribution="Customer quote from a family using BeddyBytes as part of daily life."
            quoteLabel="What a customer told me"
            supportingPoints={[
                'One purchase covers the whole household setup',
                'The flexibility replaces extra hardware in daily use',
                'Privacy and value reinforce each other instead of fighting each other',
            ]}
        />
        <UseCaseTradeoffsSection
            title="Things to know before you buy"
            intro="I want this page to help you decide if BeddyBytes is a good fit, so here are the tradeoffs I think are worth being clear about."
            items={[
                {
                    title: 'The baby station is best kept plugged in',
                    description: 'Because the baby station uses the camera and microphone continuously, it uses more battery than normal phone use. Most families keep that device plugged in while monitoring.',
                },
                {
                    title: 'Low-light performance depends on the device',
                    description: 'BeddyBytes relies on browser camera controls, so low-light results vary by device and browser. Many parents use audio monitoring or a low-level light when they want a clearer nighttime image.',
                },
                {
                    title: 'There is no App Store download',
                    description: 'BeddyBytes runs in the browser rather than through a native App Store app. That helps it work across device types, but it is worth being explicit about.',
                },
                {
                    title: 'Internet is still required for signaling',
                    description: 'BeddyBytes uses the internet to establish the session between devices, but that traffic is very small. The live media itself still stays on your local network.',
                },
            ]}
        />
        <UseCaseTextSection
            title="What Makes It A Better Fit Than Many Subscription Monitors"
            paragraphs={[
                'BeddyBytes does not relay live media and it does not store live media. The live stream stays between your own devices on your local network, which means the product does not carry the same ongoing media infrastructure costs as many subscription-led monitors.',
                'That architecture helps keep backend costs lower and pricing simpler. If you mainly care about privacy and local-only media flow, this is also what makes BeddyBytes a strong <Link to="/private-baby-monitor/">private baby monitor</Link> option.',
            ]}
        />
        <UseCasePricingSection
            title="Stop paying for baby monitor subscriptions"
            description="Choose yearly or lifetime access and use BeddyBytes across all your devices with one account."
        />
        <UseCaseFAQSection items={faqItems} />
        <UseCaseRelatedLinksSection
            links={[
                { label: 'private baby monitor', to: '/private-baby-monitor/' },
                { label: 'Baby monitor app for iPhone and Android', to: '/baby-monitor-app-iphone-and-android/' },
                { label: 'How to turn an old phone into a baby monitor', to: '/how-to-turn-an-old-phone-into-a-baby-monitor/' },
            ]}
        />
    </UseCasePage>
)

export default NoSubscriptionBabyMonitorPage

export const Head: HeadFC = () => (
    <React.Fragment>
        <SEOHead
            title="Best Baby Monitor Without Subscription? A No Subscription Option That Uses Devices You Already Own"
            description="Looking for the best baby monitor without subscription fees? BeddyBytes turns your old phone, tablet, or laptop into a baby monitor with one purchase for all your devices."
            pathname="/no-subscription-baby-monitor/"
        />
        <script type="application/ld+json">
            {JSON.stringify(webPageSchema)}
        </script>
        <script type="application/ld+json">
            {JSON.stringify(faqSchema)}
        </script>
    </React.Fragment>
)
