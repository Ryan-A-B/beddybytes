import React from 'react'
import { Link } from 'gatsby'
import DefaultPageWrapper from '../DefaultPageWrapper'
import CallToAction from '../CallToAction'
import promotion from '../../services/promotion'

import './style.scss'

interface SectionContent {
    title: string
    paragraphs: string[]
}

interface FeatureCard {
    title: string
    description: string
}

interface Tradeoff {
    title: string
    description: string
}

interface FAQItem {
    question: string
    answer: string[]
}

interface RelatedLink {
    label: string
    to: string
}

interface ChecklistSectionProps {
    title: string
    intro?: string
    items: string[]
}

interface ComparisonTableSectionProps {
    title: string
    intro?: string
    headers: string[]
    rows: string[][]
}

interface PageProps {
    children: React.ReactNode
}

interface HeroProps {
    eyebrow?: string
    title: string
    description: string
    visual: React.ReactNode
    visualVariant?: 'portrait' | 'landscape'
}

interface TrustBarProps {
    items: string[]
}

interface CardGridSectionProps {
    title: string
    items: FeatureCard[]
}

interface SplitHowItWorksSectionProps {
    howItWorks: {
        title: string
        steps: string[]
        note?: string
    }
    goodFit: {
        title: string
        items: string[]
    }
}

interface ProofSectionProps {
    title: string
    statsLabel: string
    quote: string
    attribution: string
    supportingPoints: string[]
    quoteLabel?: string
}

interface TradeoffsSectionProps {
    title: string
    intro?: string
    items: Tradeoff[]
}

interface PricingCtaSectionProps {
    title: string
    description: string
}

interface FAQSectionProps {
    items: FAQItem[]
}

interface RelatedLinksSectionProps {
    links: RelatedLink[]
}

export const UseCasePage: React.FunctionComponent<PageProps> = ({ children }) => (
    <DefaultPageWrapper without_call_to_action>
        <main id="main" className="use-case-page">
            {children}
        </main>
    </DefaultPageWrapper>
)

export const UseCaseHero: React.FunctionComponent<HeroProps> = ({ eyebrow, title, description, visual, visualVariant = 'landscape' }) => (
    <section className="use-case-page__hero">
        <div className="container">
            <div className="row align-items-center g-4 g-lg-5">
                <div className={visualVariant === 'portrait' ? 'col-lg-7' : 'col-lg-6'}>
                    {eyebrow && <p className="use-case-page__eyebrow">{eyebrow}</p>}
                    <h1>{title}</h1>
                    <p className="use-case-page__lead">{description}</p>
                    <CallToAction
                        to="/pricing"
                        color="light"
                        coupon_code={promotion.code}
                        discount={promotion.discount}
                        click_id="cta-use-case-hero"
                    />
                </div>
                <div className={visualVariant === 'portrait' ? 'col-lg-5' : 'col-lg-6'}>
                    <div className={`use-case-page__hero-visual use-case-page__hero-visual--${visualVariant}`}>
                        {visual}
                    </div>
                </div>
            </div>
        </div>
    </section>
)

export const UseCaseTrustBar: React.FunctionComponent<TrustBarProps> = ({ items }) => (
    <section className="use-case-page__trust-bar">
        <div className="container">
            <div className="use-case-page__trust-grid">
                {items.map((item) => (
                    <div key={item} className="use-case-page__trust-item">
                        {item}
                    </div>
                ))}
            </div>
        </div>
    </section>
)

export const UseCaseTextSection: React.FunctionComponent<SectionContent> = ({ title, paragraphs }) => (
    <section className="use-case-page__text-section">
        <div className="container">
            <div className="use-case-page__section-copy">
                <h2>{title}</h2>
                {paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                ))}
            </div>
        </div>
    </section>
)

export const UseCaseChecklistSection: React.FunctionComponent<ChecklistSectionProps> = ({ title, intro, items }) => (
    <section className="use-case-page__text-section">
        <div className="container">
            <div className="use-case-page__section-copy">
                <h2>{title}</h2>
                {intro && <p>{intro}</p>}
                <ul className="use-case-page__checklist">
                    {items.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </div>
        </div>
    </section>
)

export const UseCaseCardGridSection: React.FunctionComponent<CardGridSectionProps> = ({ title, items }) => (
    <section className="use-case-page__differentiators">
        <div className="container">
            <h2>{title}</h2>
            <div className="row g-4">
                {items.map((item) => (
                    <div key={item.title} className="col-md-6">
                        <article className="use-case-page__card">
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                        </article>
                    </div>
                ))}
            </div>
        </div>
    </section>
)

export const UseCaseHowItWorksSection: React.FunctionComponent<SplitHowItWorksSectionProps> = ({ howItWorks, goodFit }) => (
    <section className="use-case-page__how-it-works">
        <div className="container">
            <div className="row g-4">
                <div className="col-lg-7">
                    <div className="use-case-page__section-copy">
                        <h2>{howItWorks.title}</h2>
                        <ol>
                            {howItWorks.steps.map((step) => (
                                <li key={step}>{step}</li>
                            ))}
                        </ol>
                        {howItWorks.note && <p>{howItWorks.note}</p>}
                    </div>
                </div>
                <div className="col-lg-5">
                    <aside className="use-case-page__side-panel">
                        <h3>{goodFit.title}</h3>
                        <ul>
                            {goodFit.items.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </aside>
                </div>
            </div>
        </div>
    </section>
)

export const UseCaseProofSection: React.FunctionComponent<ProofSectionProps> = ({
    title,
    statsLabel,
    quote,
    attribution,
    supportingPoints,
    quoteLabel = 'Customer quote',
}) => (
    <section className="use-case-page__proof">
        <div className="container">
            <div className="row g-4 align-items-stretch">
                <div className="col-lg-4">
                    <div className="use-case-page__proof-stat">
                        <span>{statsLabel}</span>
                        <h2>{title}</h2>
                    </div>
                </div>
                <div className="col-lg-8">
                    <div className="use-case-page__proof-quote">
                        <span className="use-case-page__proof-label">{quoteLabel}</span>
                        <blockquote>{quote}</blockquote>
                        <p>{attribution}</p>
                        <ul>
                            {supportingPoints.map((point) => (
                                <li key={point}>{point}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>
)

export const UseCaseTradeoffsSection: React.FunctionComponent<TradeoffsSectionProps> = ({ title, intro, items }) => (
    <section className="use-case-page__tradeoffs">
        <div className="container">
            <div className="row g-4">
                <div className="col-lg-5">
                    <div className="use-case-page__section-copy">
                        <h2>{title}</h2>
                        {intro && <p>{intro}</p>}
                    </div>
                </div>
                <div className="col-lg-7">
                    <div className="row g-4">
                        {items.map((item) => (
                            <div key={item.title} className="col-md-6">
                                <article className="use-case-page__card use-case-page__card--light">
                                    <h3>{item.title}</h3>
                                    <p>{item.description}</p>
                                </article>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </section>
)

export const UseCasePricingSection: React.FunctionComponent<PricingCtaSectionProps> = ({ title, description }) => (
    <section id="pricing-cta" className="use-case-page__pricing-cta">
        <div className="container">
            <div className="use-case-page__pricing-panel">
                <div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                </div>
                <CallToAction
                    to="/pricing"
                    color="light"
                    coupon_code={promotion.code}
                    discount={promotion.discount}
                    click_id="cta-use-case-pricing"
                />
            </div>
        </div>
    </section>
)

export const UseCaseComparisonTableSection: React.FunctionComponent<ComparisonTableSectionProps> = ({
    title,
    intro,
    headers,
    rows,
}) => (
    <section className="use-case-page__comparison-table">
        <div className="container">
            <div className="use-case-page__section-copy">
                <h2>{title}</h2>
                {intro && <p>{intro}</p>}
            </div>
            <div className="use-case-page__table-wrapper">
                <table className="use-case-page__table">
                    <thead>
                        <tr>
                            {headers.map((header, headerIndex) => (
                                <th key={`${header}-${headerIndex}`} scope="col">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.join('|')}>
                                {row.map((cell, cellIndex) => (
                                    <td key={`${headers[cellIndex] ?? 'col'}-${cellIndex}-${cell}`}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </section>
)

export const UseCaseFAQSection: React.FunctionComponent<FAQSectionProps> = ({ items }) => (
    <section className="use-case-page__faq">
        <div className="container">
            <h2>FAQ</h2>
            <div className="row g-4">
                {items.map((faq) => (
                    <div key={faq.question} className="col-lg-6">
                        <article className="use-case-page__faq-item">
                            <h3>{faq.question}</h3>
                            {faq.answer.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                        </article>
                    </div>
                ))}
            </div>
        </div>
    </section>
)

export const UseCaseRelatedLinksSection: React.FunctionComponent<RelatedLinksSectionProps> = ({ links }) => (
    <section className="use-case-page__related-links">
        <div className="container">
            <h2>Related Pages</h2>
            <div className="use-case-page__related-grid">
                {links.map((link) => (
                    <Link key={link.to} to={link.to} className="use-case-page__related-link">
                        {link.label}
                    </Link>
                ))}
            </div>
        </div>
    </section>
)

export default UseCasePage
