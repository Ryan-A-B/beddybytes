import React from 'react';
import { type HeadFC } from "gatsby"
import SEOHead from '../../components/SEOHead';
import DefaultPageWrapper from '../../components/DefaultPageWrapper';
import YoutubeVideo from '../../components/YoutubeVideo';

import thumbnail from './thumbnail.webp';

const AppLink: React.FunctionComponent = () => (
    <a
        href="https://app.beddybytes.com/#create_account"
        target="_blank"
        className="link-secondary"
    >
        app
    </a>
)

const PaymentComplete: React.FunctionComponent = () => (
    <DefaultPageWrapper without_call_to_action>
        <main id="payment-complete" >
            <section className="bg-primary text-bg-primary py-5">
                <div className="container text-center">
                    <h1>Thank You for Your Purchase!</h1>
                    <p>
                        We sincerely thank you for purchasing access to BeddyBytes.
                        Your support is greatly appreciated, and plays a vital role in
                        our development process.
                    </p>
                    <p>
                        To start using the app, please visit the <AppLink />.
                    </p>
                    <a
                        href="https://app.beddybytes.com/#create_account"
                        target="_blank"
                        className="btn btn-secondary"
                    >
                        Go to the app
                    </a>
                </div>
            </section>
            <section className="py-5">
                <div className="container" style={{ maxWidth: 600 }}>
                    <h2>Getting started</h2>
                    <div className="ratio ratio-16x9 mb-3">
                        <YoutubeVideo
                            video_id="uQHlMu7m5us"
                            title="Getting started video"
                            thumbnail={thumbnail}
                        />
                    </div>
                </div>
            </section>
        </main>
    </DefaultPageWrapper>
)

export default PaymentComplete;

export const Head: HeadFC = () => <SEOHead title="Thank you!" noindex pathname="/after-checkout/" />
