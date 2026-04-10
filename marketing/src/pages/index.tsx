import * as React from "react"
import { type HeadFC, type PageProps } from "gatsby"
import { StaticImage } from "gatsby-plugin-image"
import SEOHead from "../components/SEOHead"
import DefaultPageWrapper from "../components/DefaultPageWrapper"
import DefaultHeroSection from "../components/DefaultHeroSection"
import DefaultHowToSection from "../components/DefaultHowToSection"
import SocialProofSection from "../components/SocialProof/Section"
import YoutubeVideo from "../components/YoutubeVideo"
import NoCloudBanner from "../components/NoCloudBanner"
import FAQSection from "../components/LandingPage/FAQSection"
import TrustSection from "../components/TrustSection"
import GoodFitSection from "../components/GoodFitSection"

import thumbnail from "../components/LandingPage/DemoSection/thumbnail.webp"

const IndexPage: React.FunctionComponent<PageProps> = () => {
  return (
    <DefaultPageWrapper>
      <main>
        <DefaultHeroSection>
          <React.Fragment>
            <h1>No-subscription baby monitor using devices you already own</h1>
            <NoCloudBanner />
            <p>
              Use the phone, tablet, or laptop that fits your setup at home.
              BeddyBytes streams video and audio directly between your devices
              over your home Wi-Fi, with no cloud video relay, no cloud
              recording, and no cloud storage.
            </p>
            <p>
              One purchase per household. No subscription. Unlimited baby and
              parent stations.
            </p>
          </React.Fragment>
          <StaticImage
            src="../images/BabyStationRunning.jpg"
            alt="smartphone baby station"
            aspectRatio={16 / 9}
            transformOptions={{ fit: "contain" }}
          />
        </DefaultHeroSection>
        <TrustSection />
        <DefaultHowToSection>
          <React.Fragment>
            <h2>How BeddyBytes works in 3 simple steps</h2>
            <ol>
              <li>Start Baby Station on the device near your baby.</li>
              <li>Open Parent Station on your phone, tablet, or laptop.</li>
              <li>Monitor with local video and audio streaming over your Wi-Fi.</li>
            </ol>
            <p>
              Start on the device near your baby, then connect from another
              phone, tablet, or laptop in your home.
            </p>
          </React.Fragment>
          <StaticImage
            src="../images/ParentStationLaptop.png"
            alt="parent station monitoring on a laptop"
            aspectRatio={4 / 3}
            transformOptions={{ fit: "contain" }}
          />
        </DefaultHowToSection>
        <GoodFitSection />
        <section id="demo" className="py-5">
          <div className="container">
            <h2>Watch the setup before you buy</h2>
            <p>
              See exactly what happens after purchase and how quickly you can
              get your first Baby Station running.
            </p>
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
      </main>
    </DefaultPageWrapper>
  )
}

export default IndexPage

export const Head: HeadFC = () => (
  <SEOHead
    title="No-Subscription Baby Monitor | Local-Only Video | BeddyBytes"
    description="BeddyBytes is a no-subscription baby monitor that uses your existing devices and keeps video on your local network. No cloud video relay, recording, or storage."
    pathname="/"
  />
)
