import React from 'react'
import { Link } from 'gatsby'

import './style.scss'

export interface FAQItem {
    question: string
    answer: React.ReactNode
}

export const faqLibrary = {
    internetConnection: {
        question: 'Why do I need an internet connection?',
        answer: (
            <React.Fragment>
                <p>
                    BeddyBytes uses WebRTC to send video directly between your devices.
                    To start a WebRTC connection your devices first need to find each other.
                    BeddyBytes uses the backend to introduce your devices and relay signalling
                    messages (connection metadata only) so they can establish a direct local
                    connection. No video or audio is relayed through our servers.
                </p>
                <p>
                    BeddyBytes is configured with no STUN or TURN servers, so if your devices
                    cannot connect locally the stream fails rather than falling back to a relay.
                </p>
            </React.Fragment>
        )
    },
    valueOverShopMonitor: {
        question: "What's the value over a baby monitor I can buy at the shops?",
        answer: (
            <React.Fragment>
                <p>
                    Well, first of all you don't need to leave the couch! But, on a more serious note,
                    BeddyBytes provides privacy and convenience. By creating an app which sends your
                    data directly between devices and only on your home WiFi, we greatly reduce any
                    possibility of unwanted access. Add a log in and encryption, and you're looking like
                    a pretty tough nut to crack. On the convenience front it's hard to overstate how nice
                    it is to pull up the monitor on my phone while we're having lunch and then bring it up
                    on my laptop when I go to my office.
                </p>
                <p>
                    BeddyBytes is also perfect for travel, most of us already travel with at least 2 devices,
                    which means you have everything you need. No need to stuff another thing into your
                    already overflowing baby travel bag. Which also means one less thing to forget! We've got
                    enough on our minds.
                </p>
                <p>
                    If you are weighing dedicated hardware against browser-based monitoring, this <Link to="/radio-baby-monitor-vs-wifi-baby-monitor/">radio baby monitor vs Wi-Fi baby monitor</Link> comparison is the clearest place to start.
                </p>
            </React.Fragment>
        )
    },
    secure: {
        question: 'Is it secure?',
        answer: (
                <p>
                    BeddyBytes uses WebRTC to stream video and audio directly between your devices.
                    We don't store any of your video on our servers, and we don't relay your media
                    through our servers.
                </p>
        )
    },
    nightVision: {
        question: 'Does it have night vision?',
        answer: (
            <p>
                Sadly, most smartphone cameras don't have a night vision camera. But there is an audio only mode which we use every night.
            </p>
        )
    }
} satisfies Record<string, FAQItem>

export const defaultFAQItems: FAQItem[] = [
    faqLibrary.internetConnection,
    faqLibrary.valueOverShopMonitor,
    faqLibrary.secure,
    faqLibrary.nightVision,
]

interface Props {
    items?: FAQItem[]
    className?: string
}

const FAQSection: React.FunctionComponent<Props> = ({ items = defaultFAQItems, className }) => {
    const [activeIndex, setActiveIndex] = React.useState<number | null>(null)
    const idPrefix = React.useId()
    const handleClick = (index: number) => () => {
        if (activeIndex === index) {
            setActiveIndex(null)
            return
        }
        setActiveIndex(index)
    }

    return (
        <section id="faq" className={`faq-section ${className ?? 'py-5'}`}>
            <div className="container">
                <h2 className="faq-section__title">Frequently asked questions</h2>
                <div className="faq-list">
                    {items.map((item, index) => {
                        const isActive = activeIndex === index
                        const questionId = `${idPrefix}-question-${index}`
                        const answerId = `${idPrefix}-answer-${index}`
                        return (
                            <div className="faq-list__item" key={item.question}>
                                <h3 className="faq-list__heading" id={questionId}>
                                    <button
                                        type="button"
                                        className={`faq-list__button${isActive ? ' faq-list__button--expanded' : ''}`}
                                        aria-controls={answerId}
                                        aria-expanded={isActive}
                                        onClick={handleClick(index)}
                                    >
                                        {item.question}
                                    </button>
                                </h3>
                                <div
                                    id={answerId}
                                    className="faq-list__answer"
                                    role="region"
                                    aria-labelledby={questionId}
                                    hidden={!isActive}
                                >
                                    {item.answer}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

export default FAQSection
