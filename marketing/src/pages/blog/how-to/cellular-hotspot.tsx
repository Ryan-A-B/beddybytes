import React from 'react'
import type { HeadFC } from "gatsby"
import DefaultBlogWrapper from '../../../components/DefaultBlogWrapper'
import SEOHead from '../../../components/SEOHead'

const CellularHotspotBlogPost: React.FunctionComponent = () => (
    <DefaultBlogWrapper>
        <h1>How to use BeddyBytes on a cellular hotspot: A step-by-step guide.</h1>
        <p>
            Whether you're camping in the great outdoors or on a road trip, monitoring
            your baby shouldn't be a source of worry. With BeddyBytes, you can
            keep an eye and an ear on your little one without the need for additional
            hardware. All you need are your existing devices like a smartphone,
            tablet, or computer.
        </p>
        <p>
            In a typical setting, our BeddyBytes works over a Wi-Fi connection. However,
            you might wonder, “What if I don't have access to Wi-Fi while I'm away from
            home?” The good news is, you can still use BeddyBytes by creating a
            hotspot. This guide will walk you through the process step-by-step.
        </p>
        <section>
            <h2>Requirements</h2>
            <ul>
                <li>
                    At least two devices (smartphone, tablet, computer) - one to act as a
                    camera and the other as a monitor.
                </li>
                <li>

                    A cellular connection with data capabilities.
                </li>
            </ul>
        </section>
        <section>
            <h2>Step-by-step guide</h2>
            <section>
                <h3>Step 1: Load the app before you leave</h3>
                <p>
                    While not required, we do recommend loading the app before you leave.
                    This will ensure the app has downloaded and allow you to familiarise
                    yourself.
                </p>
            </section>
            <section>
                <h3>Step 2: Create a mobile hotspot</h3>
                <p>
                    The exact way to set up a hotspot may change but these instructions
                    should get you close.
                </p>
                <section>
                    <h4>For Android users:</h4>
                    <ol>
                        <li>
                            Navigate to Settings -&gt; Connections -&gt; Mobile Hotspot
                            and Tethering
                        </li>
                        <li>Turn on “Mobile Hotspot”</li>
                    </ol>
                    <p>
                        By tapping into “Mobile Hotspot” you should be presented with the
                        network name and password for your other devices to connect to.
                    </p>
                </section>
                <section>
                    <h4>For iOS users:</h4>
                    <ol>
                        <li>
                            Navigate to Settings -&gt; Personal Hotspot
                        </li>
                        <li>
                            Toggle the switch “Allow Others to Join” to turn it on
                        </li>
                    </ol>
                    <p>
                        Underneath you should see the network name and password for your
                        other devices to connect to.
                    </p>
                </section>
                <p>
                    Be careful to ensure connecting devices don't chew through too much
                    data. It can be a nasty surprise to find that one of your devices
                    decided to download a large OS update while on a cellular connection.
                </p>
            </section>
            <section>
                <h3>Step 3: Connect the secondary device to the hotspot</h3>
                <p>
                    On your second device, go to Wi-Fi settings and connect to the hotspot
                    you just created. It is important to note that there will be a limit
                    to how far apart the 2 devices can be before signal quality degrades.
                    You should easily get at least 10m range depending on positioning and
                    obstructions. If presented with a selection for which frequency band
                    to use, 2.4GHz will reach further and has plenty of bandwidth for our
                    monitor.
                </p>
            </section>
            <section>
                <h3>Step 4: Use BeddyBytes as usual</h3>
                <p>
                    That's it, you've created the WiFi network that BeddyBytes
                    requires to work. Now you can use it as if you were still home.
                </p>
            </section>
        </section>
        <section>
            <h2>Conclusion</h2>
            <p>
                Using BeddyBytes on a cellular connection offers flexibility without
                compromising on reliability. This feature comes particularly handy when
                you are in locations without Wi-Fi. Just follow these simple steps to
                create a mobile hotspot, and you'll be able to use BeddyBytes
                wherever your travels may take you.
            </p>
        </section>
    </DefaultBlogWrapper>
)

export default CellularHotspotBlogPost

export const Head: HeadFC = () => (
    <SEOHead
        title="How to use BeddyBytes on a cellular hotspot"
        description="Learn how to use BeddyBytes with a cellular hotspot for baby monitoring on the go. Perfect for camping or road trips."
    />
)

