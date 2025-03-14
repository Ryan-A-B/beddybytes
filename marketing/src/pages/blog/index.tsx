import React from 'react'
import type { HeadFC, PageProps } from "gatsby"
import { Link } from 'gatsby'
import DefaultPageWrapper from '../../components/DefaultPageWrapper'
import SEOHead from '../../components/SEOHead'

interface ReadMoreLinkProps {
    to: string
}

const ReadMoreLink: React.FunctionComponent<ReadMoreLinkProps> = ({ to }) => (
    <Link to={to} className="stretched-link">
        Read more
    </Link>
)

const BlogIndexPage: React.FunctionComponent<PageProps> = () => {
    return (
        <DefaultPageWrapper>
            <main id="main" className="container">
                <h1 className="text-center">Blog</h1>
                <div className="row">
                    <div className="col-auto col-lg-6 col-xl-4 mb-3">
                        <article className="card card-blog">
                            <div className="card-body">
                                <h2 className="card-title">
                                    Egg-Honey Custard
                                </h2>
                                <p>
                                    Discover the simple joy of crafting a Egg-Honey Custard with this
                                    straightforward, beginner-friendly recipe. This luscious, creamy
                                    custard combines the wholesome richness of eggs, velvety cream, and
                                    a subtle sweetness from honey. Gently baked in a soothing water bath,
                                    it emerges as a high-fat delight that's as nutritious as it is 
                                    satisfying—perfect for a comforting dessert or a hearty snack. 
                                    Packed with the natural goodness of eggs, often hailed as nature's
                                    multivitamin, this custard is a treat that nourishes both body and
                                    soul.
                                </p>
                                <ReadMoreLink to="/blog/egg-honey-custard/" />
                            </div>
                        </article>
                    </div>
                    <div className="col-auto col-lg-6 col-xl-4 mb-3">
                        <article className="card card-blog">
                            <div className="card-body">
                                <h2 className="card-title">
                                    Do I Need a Baby Monitor?
                                </h2>
                                <p>
                                    When my wife and I were expecting our first child, we were
                                    bombarded with recommendations on what we should buy. From fancy
                                    bassinets that rock your baby to sleep to bottle warmers that could
                                    be controlled by an app, it seemed like there was a gadget for
                                    every possible parenting need. One item that consistently appeared
                                    at the top of every list was the baby monitor. And not just any
                                    baby monitor—oh no, it had to have video, night vision, two-way
                                    audio, sleep analytics, temperature sensors, and a 5-inch HD
                                    screen.
                                </p>
                                <ReadMoreLink to="/blog/do-i-need-a-baby-monitor/" />
                            </div>
                        </article>
                    </div>
                    <div className="col-auto col-lg-6 col-xl-4 mb-3">
                        <article className="card card-blog">
                            <div className="card-body">
                                <h2 className="card-title">
                                    Baby Routine and Ritual
                                </h2>
                                <p>
                                    Leading up to the birth of our now 2-year-old, my wife and I were
                                    reading and watching everything we could find about looking after
                                    a newborn. While in an information session run by our hospital,
                                    another soon-to-be-parent asked a question. They said they were
                                    extremely routine-driven, and asked if there was any way they could
                                    keep their routine. After a hearty chuckle from the nurse, they
                                    were told no, their routine would be going out the window. I now
                                    think this was a terrible response. Not because it was wrong, but
                                    because of what was missing.
                                </p>
                                <ReadMoreLink to="/blog/baby-routine-and-ritual/" />
                            </div>
                        </article>
                    </div>
                    <div className="col-auto col-lg-6 col-xl-4 mb-3">
                        <article className="card card-blog">
                            <div className="card-body">
                                <h2 className="card-title">
                                    The Perfect Travel Mate: How Our Baby Monitor Simplifies Family Vacations
                                </h2>
                                <p>
                                    Is it time for a well-deserved vacation with the family? Whether you're
                                    dreaming of the sound of waves crashing on the beach or the thrill of a
                                    ski slope, packing for a trip with a little one in tow can be, well,
                                    let's call it a “labour of love.” And just when you thought you had
                                    packed it all—oops!—you realise you need to find space for the baby
                                    monitor.
                                </p>
                                <ReadMoreLink to="/blog/baby-monitor-for-travel/" />
                            </div>
                        </article>
                    </div>
                    <div className="col-auto col-lg-6 col-xl-4 mb-3">
                        <article className="card card-blog">
                            <div className="card-body">
                                <h2 className="card-title">
                                    Why I built an online baby monitor from scratch
                                </h2>
                                <p>
                                    As a parent, you're always thinking about your child's comfort and
                                    safety. Is the room the right temperature? Is the car seat safely
                                    installed? Can the tottering toddler finally reach an exciting
                                    new surface which now needs to be baby proofed?
                                </p>
                                <ReadMoreLink to="/blog/why-build-from-scratch/" />
                            </div>
                        </article>
                    </div>
                    <div className="col-auto col-lg-6 col-xl-4 mb-3">
                        <article className="card card-blog">
                            <div className="card-body">
                                <h2 className="card-title">
                                    How to use BeddyBytes on a cellular hotspot: A step-by-step guide.
                                </h2>
                                <p>
                                    Whether you're camping in the great outdoors or on a road trip, monitoring
                                    your baby shouldn't be a source of worry. With our baby monitor, you can
                                    keep an eye and an ear on your little one without the need for additional
                                    hardware. All you need are your existing devices like a smartphone,
                                    tablet, or computer.
                                </p>
                                <ReadMoreLink to="/blog/how-to/cellular-hotspot/" />
                            </div>
                        </article>
                    </div>
                </div>
            </main>
        </DefaultPageWrapper>
    )
}

export default BlogIndexPage

export const Head: HeadFC = () => <SEOHead title="Blog - BeddyBytes" description="Read the latest from BeddyBytes" />