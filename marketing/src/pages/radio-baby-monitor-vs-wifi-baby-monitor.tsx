import React from 'react'
import { HeadFC } from 'gatsby'
import { StaticImage } from 'gatsby-plugin-image'
import SEOHead from '../components/SEOHead'
import {
    UseCaseCardGridSection,
    UseCaseComparisonTableSection,
    UseCaseFAQSection,
    UseCaseHero,
    UseCaseHowItWorksSection,
    UseCasePage,
    UseCasePricingSection,
    UseCaseRelatedLinksSection,
    UseCaseTextSection,
    UseCaseTradeoffsSection,
    UseCaseTrustBar,
} from '../components/UseCaseLandingPage'

const faqItems = [
    {
        question: 'Is Wi-Fi always less private than radio?',
        answer: [
            'No. The real question is whether the live media leaves your local network or gets sent through central servers.',
            'Wi-Fi by itself is not the privacy problem.',
        ],
    },
    {
        question: 'Does BeddyBytes work without internet?',
        answer: [
            'No. Internet is required to establish the connection between devices because BeddyBytes uses signaling through the backend.',
            'That traffic is very small, and the live media still stays on your local network.',
        ],
    },
    {
        question: 'Is BeddyBytes a radio baby monitor replacement?',
        answer: [
            'Yes, for some families. If you want flexibility, no subscription, and local-only live media, BeddyBytes is a strong alternative.',
            'If you want the simplicity of dedicated hardware and no account setup, a radio baby monitor may still be the better fit.',
        ],
    },
    {
        question: 'Does BeddyBytes store or relay baby monitor video?',
        answer: [
            'No. BeddyBytes does not store or relay your live media.',
            'The live stream stays between your own devices on your local network.',
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
    name: 'Radio Baby Monitor vs Wi-Fi Baby Monitor',
    description: 'Comparing radio baby monitors and Wi-Fi baby monitors? Learn the real tradeoffs in privacy, range, convenience, and cost, and see where BeddyBytes fits.',
    url: 'https://beddybytes.com/radio-baby-monitor-vs-wifi-baby-monitor/',
}

const RadioVsWifiBabyMonitorPage: React.FunctionComponent = () => (
    <UseCasePage>
        <UseCaseHero
            eyebrow="Radio baby monitor vs Wi-Fi baby monitor"
            title="Radio baby monitor vs Wi-Fi baby monitor: what actually matters?"
            description="If you are comparing radio baby monitors and Wi-Fi baby monitors, I think the usual advice is too simplistic. The real choice is privacy, convenience, range, cost, and where your baby monitor audio and video actually go."
            visualVariant="landscape"
            visual={(
                <React.Fragment>
                    <div className="use-case-page__visual-card">
                        <StaticImage
                            src="../images/ParentStationLaptop.png"
                            alt="BeddyBytes parent station monitoring on a laptop"
                        />
                    </div>
                    <div className="use-case-page__visual-note">
                        The privacy question is not just Wi-Fi or not. It is where the live media goes.
                    </div>
                </React.Fragment>
            )}
        />
        <UseCaseTrustBar
            items={[
                'Fair comparison',
                'No subscription',
                'Works across iPhone and Android',
                'Live media stays local with BeddyBytes',
            ]}
        />
        <UseCaseTextSection
            title="Quick answer"
            paragraphs={[
                'Radio baby monitors are simple, reliable, and easy to trust because they do not depend on your internet connection.',
                'Wi-Fi baby monitors are more flexible and more convenient, but they are not all the same. Some send everything through cloud services. Others, like BeddyBytes, use Wi-Fi while keeping the live media between your own devices on your local network.',
            ]}
        />
        <UseCaseCardGridSection
            title="The real comparison"
            items={[
                {
                    title: 'Radio monitor strengths',
                    description: 'Very simple setup, no app or account required, no internet dependency, and familiar single-purpose hardware.',
                },
                {
                    title: 'Radio monitor limitations',
                    description: 'Usually another piece of hardware to buy, another receiver to keep charged, and less flexibility than reusing the devices you already own.',
                },
                {
                    title: 'Wi-Fi monitor strengths',
                    description: 'More flexible parent-station options, better fit for app-based or browser-based monitoring, and more modern setups without dedicated receivers.',
                },
                {
                    title: 'Typical Wi-Fi monitor limitations',
                    description: 'Quality varies a lot, many still require hardware and subscriptions, and some route media through central cloud infrastructure.',
                },
            ]}
        />
        <UseCaseHowItWorksSection
            howItWorks={{
                title: 'Where BeddyBytes fits in that comparison',
                steps: [
                    'BeddyBytes is not trying to be a traditional radio baby monitor.',
                    'It is for parents who want the convenience of a smart baby monitor without pushing the live media through cloud infrastructure.',
                    'Live media stays on your local network, BeddyBytes does not relay or store it, and one purchase covers all your devices.',
                    'Internet is still required to establish the connection because BeddyBytes uses signaling through the backend, but that traffic is very small.',
                ],
                note: 'That last point is important: BeddyBytes uses Wi-Fi, but the live media path still stays between your own devices.',
            }}
            goodFit={{
                title: 'Choose BeddyBytes if you want',
                items: [
                    'A smart baby monitor without a subscription',
                    'A setup built from phones, tablets, or laptops you already own',
                    'Something that works across iPhone and Android',
                    'A live stream that stays off central servers',
                    'More flexibility than a dedicated monitor unit usually gives you',
                ],
            }}
        />
        <UseCaseTradeoffsSection
            title="Honest tradeoffs"
            intro="This page should be fair, so here is the shortest version of the tradeoff."
            items={[
                {
                    title: 'Radio monitors win on simplicity',
                    description: 'If your top priority is a single-purpose product that works without thinking about browsers, accounts, or device setup, radio monitors still have an advantage.',
                },
                {
                    title: 'BeddyBytes wins on flexibility',
                    description: 'If your top priority is using the devices you already have, avoiding subscription cost, and keeping the live stream off central servers, BeddyBytes is stronger.',
                },
                {
                    title: 'BeddyBytes still depends on your local setup',
                    description: 'Your devices need to work well on your network, the baby-station device is best kept plugged in, and low-light quality depends on the camera and browser.',
                },
                {
                    title: 'Internet is still required for signaling',
                    description: 'BeddyBytes is not a fully offline product today. The internet is needed to establish the connection, even though the live media still stays local.',
                },
            ]}
        />
        <UseCaseComparisonTableSection
            title="Summary table"
            headers={['Category', 'Radio Baby Monitor', 'Typical Cloud Wi-Fi Monitor', 'BeddyBytes']}
            rows={[
                ['Dedicated hardware required', 'Yes', 'Usually yes', 'No'],
                ['Subscription', 'No', 'Common', 'No'],
                ['Works with devices you already own', 'No', 'Sometimes', 'Yes'],
                ['Works across iPhone and Android', 'Not relevant', 'Sometimes', 'Yes'],
                ['Live media leaves local network', 'No', 'Often yes', 'No'],
                ['App or account usually required', 'No', 'Usually yes', 'Yes'],
                ['Setup flexibility', 'Low', 'Medium', 'High'],
            ]}
        />
        <UseCasePricingSection
            title="Want the flexibility of a Wi-Fi baby monitor without the usual cloud tradeoff?"
            description="Use BeddyBytes across the devices you already own with one purchase and no subscription."
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

export default RadioVsWifiBabyMonitorPage

export const Head: HeadFC = () => (
    <React.Fragment>
        <SEOHead
            title="Radio Baby Monitor vs Wi-Fi Baby Monitor | BeddyBytes"
            description="Comparing radio baby monitors and Wi-Fi baby monitors? Learn the real tradeoffs in privacy, range, convenience, and cost, and see where BeddyBytes fits."
            pathname="/radio-baby-monitor-vs-wifi-baby-monitor/"
        />
        <script type="application/ld+json">
            {JSON.stringify(webPageSchema)}
        </script>
        <script type="application/ld+json">
            {JSON.stringify(faqSchema)}
        </script>
    </React.Fragment>
)
