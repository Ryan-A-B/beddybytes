import React from 'react'
import './style.scss'

const SocialProofSection: React.FunctionComponent = () => (
    <section id="social-proof" className="bg-secondary text-bg-secondary py-5 ">
        <div className="container">
            <h1 className="text-center mb-4">
                Over <span className="text-light">5,000</span> hours monitored!
            </h1>
            <h3 className="text-center mb-3">
                Here's what some of our users have to say
            </h3>
            <section className="testimonials">
                <blockquote className="blockquote">
                    BeddyBytes is very easy to use and I love that it's flexible.
                    I can open the parent station on my phone or laptop depending
                    on whether I'm studying or doing housework without lugging
                    around an extra screen. Knowing that images of our family
                    life are completely private is very reassuring too.
                </blockquote>
                <blockquote className="blockquote">
                    Great job! Your emphasis on security and sustainability by
                    using existing devices is commendable.
                </blockquote>
                <blockquote className="blockquote">
                    Love that it keeps things local for privacy.
                </blockquote>
                <blockquote className="blockquote">
                    The girls were tidying the garage this morning and normally I
                    miss out on all their daily activities but I had BeddyBytes
                    running on a tablet next to me during meeting and I could see
                    and hear them so felt more included.
                </blockquote>
            </section>
        </div>
    </section>
)

export default SocialProofSection