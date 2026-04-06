import * as React from "react"
import { Link, type HeadFC, type PageProps } from "gatsby"
import { StaticImage } from "gatsby-plugin-image"
import SEOHead from "../components/SEOHead"
import DefaultPageWrapper from "../components/DefaultPageWrapper"
import DefaultHeroSection from "../components/DefaultHeroSection"
import DefaultHowToSection from "../components/DefaultHowToSection"
import Features from "../components/Features"
import SocialProofSection from "../components/SocialProof/Section"
import YoutubeVideo from "../components/YoutubeVideo"
import NoCloudBanner from "../components/NoCloudBanner"
import FAQSection from "../components/LandingPage/FAQSection"
import CallToActionSection from "../components/CallToActionSection"

import thumbnail from "../components/LandingPage/DemoSection/thumbnail.webp"

const IndexPage: React.FunctionComponent<PageProps> = () => {
  return (
    <DefaultPageWrapper>
      <main>
        <DefaultHeroSection>
          <React.Fragment>
            <h1>Private baby monitor app for modern families</h1>
            <NoCloudBanner />
            <p>
              BeddyBytes is a private baby monitor app that transforms your
              smartphone, tablet, and laptop into a secure monitoring setup in
              minutes with no cloud video relay, no cloud recording, and no
              cloud storage.
            </p>
            <p className="mb-4">
              Want to check your spare devices before you pay? Start with the
              compatibility checker and setup video.
            </p>
            <div className="d-flex flex-column flex-sm-row gap-2 justify-content-lg-start justify-content-center mb-4">
              <Link to="/compatibility/" className="btn btn-outline-light btn-lg">
                Check compatibility
              </Link>
              <Link to="#demo" className="btn btn-light btn-lg">
                Watch setup video
              </Link>
            </div>
          </React.Fragment>
          <StaticImage
            src="../images/BabyStationRunning.jpg"
            alt="smartphone baby station"
            aspectRatio={16 / 9}
            transformOptions={{ fit: "contain" }}
          />
        </DefaultHeroSection>
        <DefaultHowToSection>
          <React.Fragment>
            <h2>How this private baby monitor app works in 3 steps</h2>
            <ol>
              <li>Start Baby Station on the device near your baby.</li>
              <li>Open Parent Station on your phone, tablet, or laptop.</li>
              <li>Monitor with local video and audio streaming over your Wi-Fi.</li>
            </ol>
            <p>
              BeddyBytes uses the backend for account authentication and
              signalling. Video and audio are streamed directly between your
              devices, and recordings are saved locally on your device.
            </p>
          </React.Fragment>
          <StaticImage
            src="../images/ParentStationLaptop.png"
            alt="parent station monitoring on a laptop"
            aspectRatio={4 / 3}
            transformOptions={{ fit: "contain" }}
          />
        </DefaultHowToSection>
        <section className="py-4 bg-body-secondary">
          <div className="container">
            <div className="row g-3 align-items-center">
              <div className="col-lg-8">
                <h2 className="h4 mb-2">Reduce the obvious buyer risk before purchase</h2>
                <p className="mb-0">
                  Check whether your phones, tablets, and laptops support the browser features BeddyBytes
                  needs, then compare that against the 5-minute setup video before you head to pricing.
                </p>
              </div>
              <div className="col-lg-4 d-grid gap-2 d-sm-flex justify-content-lg-end">
                <Link to="/compatibility/" className="btn btn-primary">
                  Check compatibility
                </Link>
                <Link to="#demo" className="btn btn-outline-primary">
                  See it in action
                </Link>
              </div>
            </div>
          </div>
        </section>
        <Features>
          <h2>Key features for private baby monitoring</h2>
        </Features>
        <section className="py-4 bg-body-tertiary">
          <div className="container">
            <div className="row g-3 align-items-stretch">
              <div className="col-lg-4">
                <h2 className="h4 mb-2">Explore by use case</h2>
                <p className="mb-0 text-muted">
                  Start with the page that matches what you are trying to solve.
                </p>
              </div>
              <div className="col-lg-8">
                <div className="row g-3">
                  <div className="col-md-6">
                    <article className="card h-100 border-0 shadow-sm">
                      <div className="card-body">
                        <h3 className="h6 card-title">
                          <Link to="/no-subscription-baby-monitor/">No subscription baby monitor</Link>
                        </h3>
                        <p className="card-text mb-0">
                          For families trying to avoid recurring monitor fees.
                        </p>
                      </div>
                    </article>
                  </div>
                  <div className="col-md-6">
                    <article className="card h-100 border-0 shadow-sm">
                      <div className="card-body">
                        <h3 className="h6 card-title">
                          <Link to="/baby-monitor-app-iphone-and-android/">Baby monitor app for iPhone and Android</Link>
                        </h3>
                        <p className="card-text mb-0">
                          For cross-platform setups using phones, tablets, and laptops.
                        </p>
                      </div>
                    </article>
                  </div>
                  <div className="col-md-6">
                    <article className="card h-100 border-0 shadow-sm">
                      <div className="card-body">
                        <h3 className="h6 card-title">
                          <Link to="/how-to-turn-an-old-phone-into-a-baby-monitor/">Turn an old phone into a baby monitor</Link>
                        </h3>
                        <p className="card-text mb-0">
                          For parents ready to give a spare device a second life.
                        </p>
                      </div>
                    </article>
                  </div>
                  <div className="col-md-6">
                    <article className="card h-100 border-0 shadow-sm">
                      <div className="card-body">
                        <h3 className="h6 card-title">
                          <Link to="/radio-baby-monitor-vs-wifi-baby-monitor/">Radio baby monitor vs Wi-Fi baby monitor</Link>
                        </h3>
                        <p className="card-text mb-0">
                          For comparing dedicated hardware with a private browser-based setup.
                        </p>
                      </div>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="demo" className="py-5">
          <div className="container">
            <h2>Set up your private baby monitor app in under 5 minutes</h2>
            <div className="ratio ratio-16x9 mb-3">
              <YoutubeVideo
                video_id="uQHlMu7m5us"
                title="Getting started video"
                thumbnail={thumbnail}
              />
            </div>
          </div>
        </section>
        <SocialProofSection />
        <FAQSection />
        <CallToActionSection to="/pricing" />
      </main>
    </DefaultPageWrapper>
  )
}

export default IndexPage

export const Head: HeadFC = () => (
  <SEOHead
    title="Private Baby Monitor App | No Cloud Video Relay | BeddyBytes"
    description="BeddyBytes is a private baby monitor app with local-only video streaming, no cloud video relay, no cloud recording, and no cloud storage. No subscription."
    pathname="/"
  />
)
