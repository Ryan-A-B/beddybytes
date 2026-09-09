import React from "react"
import { type HeadFC, type PageProps } from "gatsby"
import SEOHead from "../components/SEOHead"
import DefaultPageWrapper from "../components/DefaultPageWrapper"

const PrivacyContactLink: React.FunctionComponent = () => (
    <a href="mailto:ryan@beddybytes.com">ryan@beddybytes.com</a>
)

const PaymentProviderPrivacyPolicyLink: React.FunctionComponent = () => (
    <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
        Stripe's privacy policy
    </a>
)

const PrivacyPolicy: React.FunctionComponent<PageProps> = () => (
    <DefaultPageWrapper>
        <main className="container py-5">
            <h1>Privacy Policy</h1>
            <p className="lead">
                The only directly identifying information BeddyBytes stores for
                your account is your email address. We use it for login, account
                management, and password resets.
            </p>
            <p>
                BeddyBytes also records account-linked connection and monitoring
                events so we can operate the service, measure usage, and diagnose
                problems. No video, audio or images pass through our servers, 
                and we do not store your photos or recordings.
            </p>

            <section className="my-5">
                <h2>Information BeddyBytes collects</h2>

                <h3 className="h4 mt-4">Account information</h3>
                <p>
                    We store your email address, account and user identifiers, and
                    the authentication information needed to secure your account.
                    Your password is stored as a salted hash, not as readable text.
                </p>

                <h3 className="h4 mt-4">Connection and monitoring events</h3>
                <p>
                    We record when a client connects or disconnects and when a
                    monitoring session starts or ends. These records include the
                    relevant account, user, client, connection, and session
                    identifiers, timestamps, connection status information, and the
                    baby-station name you enter. They do not contain video or audio.
                </p>

                <h3 className="h4 mt-4">Short-term diagnostics and analytics</h3>
                <p>
                    We collect limited website and app telemetry to track issues and
                    understand whether the service is working. This can include page
                    views, time spent on a page, selected button clicks, generated
                    browser and app identifiers, browser information, account
                    identifiers after login, and diagnostic log messages. This data
                    is retained for 14 days.
                </p>

                <h3 className="h4 mt-4">Information you send us</h3>
                <p>
                    If you contact us for support, feedback, or a privacy request,
                    we receive the information you choose to include in that
                    message. We use it to respond to you and resolve the issue.
                </p>
            </section>

            <section className="my-5">
                <h2>What BeddyBytes does not collect</h2>
                <p>
                    BeddyBytes uses WebRTC to send live video and audio directly
                    between your devices. Our servers help your devices find each
                    other and exchange connection information, but they do not relay
                    or store the live media stream.
                </p>
                <p>
                    Photos and recordings are created and stored on your own device.
                    BeddyBytes does not upload or store them.
                </p>
            </section>

            <section className="my-5">
                <h2>How we use information</h2>
                <p>We use the information described above to:</p>
                <ul>
                    <li>create, secure, and provide access to your account;</li>
                    <li>send password-reset emails you request;</li>
                    <li>connect your devices and operate monitoring sessions;</li>
                    <li>measure aggregate monitored time and service usage;</li>
                    <li>diagnose errors, connection problems, and reliability issues; and</li>
                    <li>respond to support, privacy, and account requests.</li>
                </ul>
                <p>
                    We do not sell personal information or use it for third-party
                    advertising.
                </p>
            </section>

            <section className="my-5">
                <h2>Payments and service providers</h2>
                <p>
                    Stripe processes purchases and collects the email, payment, and
                    billing information requested on its checkout page. BeddyBytes
                    does not store your card details. You can read more in <PaymentProviderPrivacyPolicyLink />.
                </p>
                <p>
                    BeddyBytes is operated from Australia. Account information,
                    operational events, diagnostics, and password-reset email
                    delivery use BeddyBytes infrastructure hosted with Amazon Web
                    Services in the US East (Northern Virginia) region (us-east-1).
                    Stripe may process information in other countries as described
                    in its privacy policy.
                </p>
            </section>

            <section className="my-5">
                <h2>Storage, retention, and deletion</h2>
                <p>
                    Account information is kept while your account exists. The
                    operational event history used to calculate usage and diagnose
                    service behaviour does not currently expire automatically.
                    Short-term telemetry expires after 14 days.
                </p>
                <p>
                    There is no self-service account-deletion control. You can ask us
                    to delete your account by emailing <PrivacyContactLink />. We will
                    remove the active account record and replace directly identifying
                    values, including your email address and user-provided
                    baby-station names, with hashed values in the historical event
                    log. The remaining event records may be retained for aggregate
                    usage measurement and service diagnostics without the original
                    email address or station names.
                </p>
            </section>

            <section className="my-5">
                <h2>Access, correction, and complaints</h2>
                <p>
                    To ask what information we hold about you, correct your email
                    address, request deletion, or make a privacy complaint, email <PrivacyContactLink />.
                    We may need to verify that the account belongs to you before
                    acting on a request.
                </p>
            </section>

            <section className="my-5">
                <h2>Changes to this policy</h2>
                <p>
                    We will update this page when our data handling changes. The date
                    below shows when this policy was last revised.
                </p>
                <p><strong>Last updated: 4 September 2026</strong></p>
            </section>
        </main>
    </DefaultPageWrapper>
)

export default PrivacyPolicy

export const Head: HeadFC = () => (
    <SEOHead
        title="Privacy Policy - BeddyBytes"
        description="How BeddyBytes collects, uses, stores, and protects account and service data."
        pathname="/privacy-policy/"
    />
)
