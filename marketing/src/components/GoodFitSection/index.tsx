import React from "react";
import { Link } from "gatsby";

import "./style.scss";

const GoodFitSection: React.FunctionComponent = () => (
    <section id="good-fit" className="good-fit-section py-5 bg-body-tertiary">
        <div className="container">
            <div className="good-fit-section__header">
                <h2>BeddyBytes is a good fit if...</h2>
                <p className="good-fit-section__intro">
                    It is not trying to be everything. It is built for families
                    who want a simple, private baby monitor that works around
                    the house with the devices that fit their setup.
                </p>
            </div>
            <div className="good-fit-section__grid">
                <article className="good-fit-section__card">
                    <h3>You want to avoid another subscription</h3>
                    <p>
                        Buy BeddyBytes once and keep using it without adding
                        another monthly bill.
                    </p>
                    <p className="good-fit-section__link">
                        <Link to="/no-subscription-baby-monitor/">No Subscription Baby Monitor</Link>
                    </p>
                </article>
                <article className="good-fit-section__card">
                    <h3>You want flexibility in the devices you use</h3>
                    <p>
                        Use a current phone, a spare tablet, a laptop, or a
                        mix of them.
                    </p>
                    <p className="good-fit-section__link">
                        <Link to="/baby-monitor-app-iphone-and-android/">Works across iPhone, Android, tablets, and laptops</Link>
                    </p>
                </article>
                <article className="good-fit-section__card">
                    <h3>You care about privacy</h3>
                    <p>
                        Video and audio stay between your devices on your home
                        network.
                    </p>
                    <p className="good-fit-section__link">
                        <Link to="/private-baby-monitor/">Private Baby Monitor</Link>
                    </p>
                </article>
                <article className="good-fit-section__card">
                    <h3>You do not need out-of-home viewing</h3>
                    <p>
                        BeddyBytes is built for monitoring around the house and
                        nowhere else.
                    </p>
                </article>
            </div>
        </div>
    </section>
);

export default GoodFitSection;
