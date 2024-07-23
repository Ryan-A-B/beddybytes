import * as React from "react"
import type { HeadFC, PageProps } from "gatsby"
import { StaticImage } from 'gatsby-plugin-image'
import DefaultPageWrapper from "../components/DefaultPageWrapper"
import DefaultHeroSection from "../components/DefaultHeroSection"
import Features from "../components/Features"
import SocialProofSection from "../components/SocialProof/Section"

const IndexPage: React.FunctionComponent<PageProps> = () => {
  return (
    <DefaultPageWrapper>
      <main>
        <DefaultHeroSection>
          <React.Fragment>
            <h1>The privacy-first baby camera</h1>
            <p>
              Transform your smartphone and laptop into a private baby camera
              and monitor within minutes. Your family's privacy is paramount
              - with BeddyBytes, images and videos never leave your devices.
            </p>
          </React.Fragment>
          <StaticImage
            src="../images/BabyStation.png"
            alt="smartphone baby station"
            aspectRatio={16 / 9}
            transformOptions={{ fit: "contain" }}
          />
        </DefaultHeroSection>
        <Features>
          <h2>Features</h2>
        </Features>
        <SocialProofSection />
      </main>
    </DefaultPageWrapper>
  )
}

export default IndexPage

export const Head: HeadFC = () => <title>BeddyBytes</title>













































const OldStuff: React.FunctionComponent = () => (
  <section className="bg-body-tertiary py-5">
    <div className="container">
      <div className="row">
        <div className="col-auto col-lg-6 mb-3">
          <section className="card">
            <div className="card-body">
              <h2 className="card-title">
                <span className="ts-1">🔒</span> Private
              </h2>
              <p>
                All video and audio is streamed directly between your own devices;
                no video or audio ever gets sent to our server (or any third party).
              </p>
            </div>
          </section>
        </div>
        <div className="col-auto col-lg-6 mb-3">
          <section className="card">
            <div className="card-body">
              <h2 className="card-title">
                <span className="ts-1">🧘</span> Flexible
              </h2>
              <p>
                The number of cameras and monitors you can use is only limited by the
                number of devices you have. Two caregivers monitoring one baby on
                separate devices? No problem. One or two caregivers monitoring
                multiple babies sleeping in different rooms? Also possible.
              </p>
            </div>
          </section>
        </div>
        <div className="col-auto col-lg-6 mb-3">
          <section className="card">
            <div className="card-body">
              <h2 className="card-title">
                <span className="ts-1">🚀</span> Fast
              </h2>
              <p>
                Your video stream doesn't get sent to a data centre halfway around
                the world and back, meaning minimal delay, lag and buffering.
              </p>
            </div>
          </section>
        </div>
        <div className="col-auto col-lg-6 mb-3">
          <section className="card">
            <div className="card-body">
              <h2 className="card-title">
                <span className="ts-1">✅</span> Efficient
              </h2>
              <p>
                Your video stream is kept within your local network, so internet
                bandwidth is dramatically reduced.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>
)