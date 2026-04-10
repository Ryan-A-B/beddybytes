import React from "react";

import "./style.scss";

const TrustSection: React.FunctionComponent = () => (
    <section id="trust" className="trust-section py-5 bg-body-tertiary">
        <div className="container">
            <div className="trust-section__header">
                <h2>What you should know before you buy</h2>
                <p className="trust-section__intro">
                    BeddyBytes is built around a few simple ideas: privacy, no
                    subscription, and using the devices that already make sense
                    in your home.
                </p>
            </div>
            <div className="trust-section__grid">
                <article className="trust-section__card">
                    <p className="trust-section__card-eyebrow">Privacy</p>
                    <h3>Video stays on your local network</h3>
                    <div className="trust-section__card-body">
                        <p>
                            BeddyBytes uses the backend for account login and
                            connection setup. Your video and audio stream
                            directly between your devices on your home network.
                        </p>
                    </div>
                </article>
                <article className="trust-section__card">
                    <p className="trust-section__card-eyebrow">Purchase</p>
                    <h3>One purchase covers the whole household</h3>
                    <div className="trust-section__card-body">
                        <p>
                            Use as many baby stations and parent stations as
                            you need on phones, tablets, and laptops without
                            adding recurring subscription fees.
                        </p>
                    </div>
                </article>
                <article className="trust-section__card">
                    <p className="trust-section__card-eyebrow">Risk</p>
                    <h3>30-day refund guarantee</h3>
                    <div className="trust-section__card-body">
                        <p>
                            If BeddyBytes is not the right fit for your setup,
                            you can request a refund within 30 days.
                        </p>
                    </div>
                </article>
                <article className="trust-section__card">
                    <p className="trust-section__card-eyebrow">Designed For</p>
                    <h3>Built for monitoring on the same home network</h3>
                    <div className="trust-section__card-body">
                        <p>
                            BeddyBytes is designed for home Wi-Fi monitoring,
                            not out-of-home viewing. That is part of how it
                            keeps the setup simple and private.
                        </p>
                    </div>
                </article>
            </div>
        </div>
    </section>
);

export default TrustSection;
