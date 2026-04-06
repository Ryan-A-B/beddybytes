import React from 'react'
import { Link } from 'gatsby'
import './style.scss'

const SocialProofSection: React.FunctionComponent = () => (
    <section id="social-proof" className="bg-secondary text-bg-secondary py-5 ">
        <div className="container">
            <div className="row g-3 justify-content-center text-center mb-4 proof-metrics">
                <div className="col-sm-4">
                    <div className="proof-metric">
                        <strong>20,000+</strong>
                        <span>hours monitored</span>
                    </div>
                </div>
                <div className="col-sm-4">
                    <div className="proof-metric">
                        <strong>30 days</strong>
                        <span>refund guarantee</span>
                    </div>
                </div>
                <div className="col-sm-4">
                    <div className="proof-metric">
                        <strong>Use your own</strong>
                        <span>phones, tablets, and laptops</span>
                    </div>
                </div>
            </div>
            <h2 className="text-center mb-2">Proof from real-world use</h2>
            <p className="text-center mb-4">
                Families usually want three things answered before they buy:
                will it work on their spare devices, is setup manageable, and does the privacy claim hold up?
                Start with <Link to="/compatibility/">compatibility</Link>, then watch the demo video before you buy.
            </p>
            <section className="testimonials">
                <figure className="blockquote">
                    <blockquote>
                        BeddyBytes is very easy to use and I love that it's flexible.
                        I can open the parent station on my phone or laptop depending
                        on whether I'm studying or doing housework without lugging
                        around an extra screen. Knowing that images of our family
                        life are completely private is very reassuring too.
                    </blockquote>
                    <figcaption>Parent using phone and laptop monitoring</figcaption>
                </figure>
                <figure className="blockquote">
                    <blockquote>
                        Great job! Your emphasis on security and sustainability by
                        using existing devices is commendable.
                    </blockquote>
                    <figcaption>Early customer focused on privacy and reuse</figcaption>
                </figure>
                <figure className="blockquote">
                    <blockquote>
                        Love that it keeps things local for privacy.
                    </blockquote>
                    <figcaption>Parent prioritising local-only streaming</figcaption>
                </figure>
                <figure className="blockquote">
                    <blockquote>
                        The girls were tidying the garage this morning and normally I
                        miss out on all their daily activities but I had BeddyBytes
                        running on a tablet next to me during meeting and I could see
                        and hear them so felt more included.
                    </blockquote>
                    <figcaption>Parent monitoring from a tablet during work</figcaption>
                </figure>
            </section>
        </div>
    </section>
)

export default SocialProofSection
