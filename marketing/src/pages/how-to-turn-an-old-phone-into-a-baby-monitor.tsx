import React from 'react'
import { HeadFC } from 'gatsby'
import { StaticImage } from 'gatsby-plugin-image'
import SEOHead from '../components/SEOHead'
import {
    UseCaseCardGridSection,
    UseCaseChecklistSection,
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
        question: 'Can I really use an old phone as a baby monitor?',
        answer: [
            'Yes. For many families, an old phone is a practical baby-station device, especially for naps and everyday use at home.',
        ],
    },
    {
        question: 'Do I need to buy BeddyBytes for each device?',
        answer: [
            'No. One purchase covers your account, and you can use multiple baby stations and parent stations.',
        ],
    },
    {
        question: 'Does it work across iPhone and Android?',
        answer: [
            'Yes. BeddyBytes works across iPhone, Android, tablets, and laptops through the browser.',
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
            'Yes. Internet is required to establish the connection, but the traffic is very small.',
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
    name: 'How to Turn an Old Phone Into a Baby Monitor',
    description: 'Turn an old phone into a baby monitor using devices you already own. See what you need, what tradeoffs to expect, and how BeddyBytes fits.',
    url: 'https://beddybytes.com/how-to-turn-an-old-phone-into-a-baby-monitor/',
}

const OldPhoneBabyMonitorPage: React.FunctionComponent = () => (
    <UseCasePage>
        <UseCaseHero
            eyebrow="How to turn an old phone into a baby monitor"
            title="How to turn an old phone into a baby monitor"
            description="If you already have an old phone in a drawer, you may already have most of what you need for a baby monitor. The key is choosing a setup that is practical, private, and easy enough to use every day."
            visualVariant="portrait"
            visual={(
                <React.Fragment>
                    <div className="use-case-page__visual-card">
                        <StaticImage
                            src="../images/BabyStationRunning.jpg"
                            alt="older phone running the BeddyBytes baby station"
                        />
                    </div>
                    <div className="use-case-page__visual-note">
                        A spare phone can become the baby station. Your main phone, tablet, or laptop can be the parent station.
                    </div>
                </React.Fragment>
            )}
        />
        <UseCaseTrustBar
            items={[
                'Reuse devices you already own',
                'No subscription',
                'Works across iPhone and Android',
                '30-day refund, no questions asked',
            ]}
        />
        <UseCaseChecklistSection
            title="Quick answer"
            intro="Yes, you can turn an old phone into a baby monitor. For most families, the simplest version looks like this:"
            items={[
                'Use the old phone as the baby station',
                'Use your current phone, tablet, or laptop as the parent station',
                'Keep the baby-station device plugged in during use',
                'Start the baby station and open the parent station on the device you want to monitor from',
            ]}
        />
        <UseCaseTextSection
            title="Why people want to reuse an old phone"
            paragraphs={[
                'It saves money, avoids buying more hardware, and gives an unused device a second life.',
                'For a lot of families, the appeal is also speed. If you already own the hardware, getting started can be faster than researching and buying another product category from scratch.',
            ]}
        />
        <UseCaseCardGridSection
            title="What makes a good old-phone baby monitor setup"
            items={[
                {
                    title: 'Easy setup',
                    description: 'If it takes too much effort to start a session, you will feel it every nap time.',
                },
                {
                    title: 'Cross-platform compatibility',
                    description: 'A good setup should work with the devices you actually own, not just the devices one company wishes you owned.',
                },
                {
                    title: 'Low ongoing cost',
                    description: 'If you are reusing old hardware to save money, a monthly subscription works against the whole point.',
                },
                {
                    title: 'Practical privacy',
                    description: 'If you care about privacy, the real question is where the live media goes once the session starts.',
                },
            ]}
        />
        <UseCaseHowItWorksSection
            howItWorks={{
                title: 'How BeddyBytes fits an old-phone setup',
                steps: [
                    'On the old phone, open BeddyBytes as the baby station.',
                    'Give the baby station a name, choose the microphone, choose the camera, and click start.',
                    'BeddyBytes remembers those settings between sessions.',
                    'On your main phone, tablet, or laptop, open the parent station and it connects automatically when a session is available.',
                ],
                note: 'If you have more than one baby station, use the dropdown to switch between them. BeddyBytes does not limit how many baby stations or parent stations can be active at the same time.',
            }}
            goodFit={{
                title: 'Probably a good fit if you want',
                items: [
                    'A baby monitor built from a spare phone you already own',
                    'No subscription underneath the setup',
                    'Something that works across mixed iPhone and Android devices',
                    'A practical setup for naps, evenings, or travel',
                    'A smart monitor without pushing live media through cloud relays',
                ],
            }}
        />
        <UseCaseProofSection
            statsLabel="Practical daily use"
            title="Reuse only works if it is easy"
            quote="BeddyBytes is very easy to use and I love that it's flexible. I can open the parent station on my phone or laptop depending on whether I'm studying or doing housework without lugging around an extra screen."
            attribution="Customer quote from a family using BeddyBytes in daily life."
            quoteLabel="What a customer told me"
            supportingPoints={[
                'The parent station can live on the devices you already use',
                'The setup is flexible enough for normal family routines',
                'Reuse works better when it does not add friction',
            ]}
        />
        <UseCaseTradeoffsSection
            title="Things to know before you rely on an old phone"
            intro="If you are using an old phone as the baby station, here are the tradeoffs I think are worth being clear about."
            items={[
                {
                    title: 'Keep it plugged in',
                    description: 'The baby-station device uses the camera and microphone continuously, so battery drain is higher than normal. Most families keep that device plugged in while using it.',
                },
                {
                    title: 'Low-light quality depends on the device',
                    description: 'An older phone can still work well, but low-light performance depends heavily on the camera and browser.',
                },
                {
                    title: 'Internet is required to establish the session',
                    description: 'BeddyBytes uses the internet to establish the connection between devices because it uses the backend for signaling. That traffic is very small, and the live media still stays on your local network.',
                },
                {
                    title: 'The baby-station device is effectively dedicated during use',
                    description: 'This setup is usually best with a spare device, especially for regular use.',
                },
            ]}
        />
        <UseCaseTextSection
            title="Old phone setup vs buying a dedicated baby monitor"
            paragraphs={[
                'Buying a dedicated baby monitor can still make sense if you want a single-purpose device and the simplest possible setup.',
                'Reusing an old phone makes more sense if you already have spare hardware, want to avoid subscription costs, and want the parent station on devices you already use.',
            ]}
        />
        <UseCasePricingSection
            title="Turn your old phone into a baby monitor with BeddyBytes"
            description="Use the devices you already own, skip the subscription, and keep live media on your local network."
        />
        <UseCaseFAQSection items={faqItems} />
        <UseCaseRelatedLinksSection
            links={[
                { label: 'Private baby monitor', to: '/private-baby-monitor/' },
                { label: 'No subscription baby monitor', to: '/no-subscription-baby-monitor/' },
                { label: 'Radio baby monitor vs Wi-Fi baby monitor', to: '/radio-baby-monitor-vs-wifi-baby-monitor/' },
            ]}
        />
    </UseCasePage>
)

export default OldPhoneBabyMonitorPage

export const Head: HeadFC = () => (
    <React.Fragment>
        <SEOHead
            title="How to Turn an Old Phone Into a Baby Monitor | BeddyBytes"
            description="Turn an old phone into a baby monitor using devices you already own. See what you need, what tradeoffs to expect, and how BeddyBytes fits."
            pathname="/how-to-turn-an-old-phone-into-a-baby-monitor/"
        />
        <script type="application/ld+json">
            {JSON.stringify(webPageSchema)}
        </script>
        <script type="application/ld+json">
            {JSON.stringify(faqSchema)}
        </script>
    </React.Fragment>
)
