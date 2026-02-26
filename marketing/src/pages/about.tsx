import React from "react";
import type { HeadFC, PageProps } from "gatsby"
import SEOHead from "../components/SEOHead";
import DefaultPageWrapper from "../components/DefaultPageWrapper";

const AboutPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper>
            <main className="bg-body-tertiary py-5">
                <div className="container">
                    <h1>BeddyBytes puts your family's privacy first</h1>
                    <p>
                        Our mission is simple: to help parents make the most of their baby's nap time,
                        without compromising on their family's privacy.
                    </p>
                    <h2>Why I built BeddyBytes</h2>
                    <p>
                        In 2022, my wife and I welcomed a beautiful baby girl into the world.
                        When our daughter slept, one of us would always stay near enough to
                        hear when she woke. After a few weeks of this, we were starting to feel
                        like we were tied to her cot. The obvious solution was, of course, to get
                        a baby monitor. But which one?
                    </p>
                    <p>
                        The first category of baby monitors we looked at sent the video stream via
                        the internet. As a software engineer, I found this concerning from a privacy
                        point of view - and silly from an efficiency standpoint. Privacy is a concern
                        because you're relying on a company's good security practices, which we all know
                        from the continuous stream of data leaks in the news is laughable. The efficiency
                        of these systems are also questionable; the vast majority of the time the monitor
                        is less than 100m from the baby, but the video stream needs to travel from the
                        camera at least a few 100km to the nearest data centre and back to the monitor,
                        consuming internet bandwidth and adding latency in both directions.
                    </p>
                    <p>
                        The other type of system we looked at were the packs containing a camera and a
                        monitor or two. These were more efficient but less flexible and can have their
                        own security concerns. Less flexible because if you wanted additional cameras
                        or monitors you'd have to buy a new pack, and are locked into a specific ecosystem.
                        The security concerns for these systems are due to the encryption protocol (if any)
                        used. In practice, if a weak encryption protocol is used, the baby monitor could
                        give nearby bad actors eyes and ears inside your home.
                    </p>
                    <h2>How I built BeddyBytes</h2>
                    <p>
                        So, what is a software engineer to do? I created a secure and flexible app that
                        solved these pain points. At the core of the app is a technology called WebRTC
                        which allows devices to securely send video, audio and data peer to peer. By
                        directly streaming video between the camera and monitor I achieved a number of
                        benefits. First, the video never reaches the server so there is no risk of video
                        being leaked by the server. Second, the video is transmitted over the local
                        network so only a very small amount of internet bandwidth is required and
                        latency is reduced. Third, WebRTC (and thus this baby monitor) uses TLS to
                        secure the video stream in transit which means the same technology that is
                        used to protect your credit card details is used to protect the video stream
                        of your baby. Finally, WebRTC works on anything that can run a relatively
                        modern web browser. This allowed us to reuse an old phone giving it a new
                        purpose, reducing e-waste, and meant both my wife and I could use our existing
                        devices (computers and phones) as monitors.
                    </p>
                </div>
            </main>
        </DefaultPageWrapper>
    );
};

export default AboutPage;

export const Head: HeadFC = () => <SEOHead title="About - BeddyBytes" description="Learn about the story behind BeddyBytes and how it puts your family's privacy first" pathname="/about/" />
