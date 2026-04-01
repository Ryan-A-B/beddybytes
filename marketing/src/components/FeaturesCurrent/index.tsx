import React from 'react'
import { Link } from 'gatsby'

const FeaturesCurrent: React.FunctionComponent = () => {
    return (
        <section>
            <h4>Available now</h4>
            <section>
                <h5>Video and audio monitoring</h5>
                <p>
                    Keep an eye on your little one from anywhere your home WiFi reaches.
                </p>
            </section>
            <section>
                <h5>Audio only monitoring</h5>
                <p>
                    If a baby monitor only has one feature, this is it.
                </p>
            </section>
            <section>
                <h5>Monitor from multiple devices</h5>
                <p>
                    Monitor from your phone while your grabbing some lunch, and from your laptop while you're working.
                </p>
            </section>
            <section>
                <h5>Monitor from any modern web browser</h5>
                <p>
                    Simply log in and you're good to go. That also makes it a practical <Link to="/baby-monitor-app-iphone-and-android/">baby monitor app for iPhone and Android</Link> if your devices do not match.
                </p>
            </section>
            <section>
                <h5>Recording</h5>
                <p>
                    There aren't many things cuter than a baby talking and singing to themselves in their
                    cot (except when it's 3am and they want to “Dance? Dance? Dance?”).
                </p>
            </section>
        </section>
    )
}

export default FeaturesCurrent