import React from 'react';
import { type HeadFC } from "gatsby"
import DefaultPageWrapper from '../../components/DefaultPageWrapper';
import YoutubeVideo from '../../components/YoutubeVideo';

import thumbnail from './thumbnail.webp';
import MicrosoftTrackingTag from '../../components/MicrosoftTrackingTag';

const AppLink: React.FunctionComponent = () => (
    <a href="https://app.beddybytes.com/#create_account" className="link-secondary" target="_blank">app</a>
)

const PaymentComplete: React.FunctionComponent = () => (
    <DefaultPageWrapper include_call_to_action_section={false}>
        <main id="payment-complete" >
            <section className="bg-primary text-bg-primary py-5">
                <div className="container">
                    <div className="row">
                        <div className="col text-center">
                            <h1>Thank You for Your Purchase!</h1>
                            <p>
                                We sincerely thank you for purchasing early access to BeddyBytes.
                                Your support is greatly appreciated, and plays a vital role in
                                our development process.
                            </p>
                            <p>
                                To start using the app, please visit the <AppLink />.
                            </p>
                        </div>
                    </div>
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

export const Head: HeadFC = () => (
    <React.Fragment>
        <title>Thank you!</title>
        <MicrosoftTrackingTag />
    </React.Fragment>
)