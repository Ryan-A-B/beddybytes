import * as React from "react"
import type { HeadFC, PageProps } from "gatsby"
import DefaultPageWrapper from "../components/DefaultPageWrapper"
import PurchaseLifetimeAccessCallToAction from "../components/CallToAction/PurchaseLifetimeAccessCallToAction"

const IndexPage: React.FunctionComponent<PageProps> = () => {
  return (
    <DefaultPageWrapper>
      <h1>The privacy-first baby camera</h1>
      <p>
        Transform your smartphone and laptop into a private baby camera and
        monitor within minutes. Your family's privacy is paramount - with
        BeddyBytes, images and videos never leave your own devices.
      </p>
      <div className="row">
        <div className="col-auto col-lg-6 mb-3">
          <section className="card">
            <div className="card-body">
              <h2 className="card-title">
                <img draggable="false" role="img" alt="🔒" /> Private
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
                <img draggable="false" role="img" alt="🧘" /> Flexible</h2>
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
                <img draggable="false" role="img" alt="🚀" /> Fast
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
                <img draggable="false" role="img" alt="✅" /> Efficient
              </h2>
              <p>
                Your video stream is kept within your local network, so internet
                bandwidth is dramatically reduced.
              </p>
            </div>
          </section>
        </div>
      </div>
      <PurchaseLifetimeAccessCallToAction />
    </DefaultPageWrapper>
  )
}

export default IndexPage

export const Head: HeadFC = () => <title>BeddyBytes</title>
