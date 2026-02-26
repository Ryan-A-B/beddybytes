import React from 'react'

interface FAQItem {
    question: string
    answer: React.ReactNode
}

const items: FAQItem[] = [
    {
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
                    In the future we plan to support a full offline mode using a self-hosted MQTT
                    server on your local network.
                </p>
            </React.Fragment>
        )
    },
    {
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
            </React.Fragment>
        )
    },
    {
        question: 'Is it secure?',
        answer: (
                <p>
                    BeddyBytes uses WebRTC to stream video and audio directly between your devices.
                    We don't store any of your video on our servers, and we don't relay your media
                    through our servers.
                </p>
        )
    },
    {
        question: 'Why does the password need to be so long?',
        answer: (
            <p>
                Apparently not everyone appreciates a strong (20+ characters) password as much as I do.
                I'll reduce the minimum length and later replace the password login.
            </p>
        )
    },
    {
        question: 'Does it have night vision?',
        answer: (
            <p>
                Sadly, most smartphone cameras don't have a night vision camera. But there is an audio only mode which we use every night.
            </p>
        )
    }
]

const ActiveButtonProps = {
    'className': 'accordion-button',
    'aria-expanded': true,
}


const InactiveButtonProps = {
    'className': 'accordion-button collapsed',
    'aria-expanded': false,
}

const getButtonProps = (isActive: boolean) => {
    return isActive ? ActiveButtonProps : InactiveButtonProps
}

const CollapseClassName = 'accordion-collapse collapse'
const ActiveCollapseClassName = `${CollapseClassName} show`

const getCollapseClassName = (isActive: boolean) => {
    return isActive ? ActiveCollapseClassName : CollapseClassName
}

const FAQSection: React.FunctionComponent = () => {
    const [activeIndex, setActiveIndex] = React.useState<number | null>(null)
    const handleClick = (index: number) => () => {
        if (activeIndex === index) {
            setActiveIndex(null)
            return
        }
        setActiveIndex(index)
    }

    return (
        <section id="faq" className="py-5">
            <div className="container">
                <h2>Frequently asked questions</h2>
                <div className="accordion">
                    {items.map((item, index) => {
                        const isActive = activeIndex === index
                        return (
                            <section className="accordion-item" key={item.question}>
                                <h3 className="accordion-header">
                                    <button type="button" onClick={handleClick(index)} {...getButtonProps(isActive)}>
                                        {item.question}
                                    </button>
                                </h3>
                                <div className={getCollapseClassName(isActive)}>
                                    <div className="accordion-body">
                                        {item.answer}
                                    </div>
                                </div>
                            </section>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

export default FAQSection
