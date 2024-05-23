import React from "react";
import { type HeadFC, type PageProps } from "gatsby"
import DefaultPageWrapper from "../components/DefaultPageWrapper";

const PaymentProviderPrivacyPolicyLink: React.FunctionComponent = () => (
    <a href="https://squareup.com/privacy" target="_blank">
        Square's privacy policy
    </a>
)

const PrivacyPolicy: React.FunctionComponent<PageProps> = () => (
    <DefaultPageWrapper>
        <main className="container">
            <h1 className="mt-5">Privacy Policy</h1>
            <p>
                I probably shouldn't write this myself. One day if this project
                goes well I'll hire a lawyer who'll tell me all the things I've
                done wrong. But, if I'm going to claim that BeddyBytes is putting
                your family's privacy first, then you deserve better than a
                vague "we take your privacy seriously" message.
            </p>
            <section className="my-5">
                <h2>Information we collect</h2>
                <p>
                    We directly collect your email address and
                    anonymous website analytics.
                </p>
                <p>
                    We use Square to process payments. At this time the
                    Square checkout page asks for your phone number, email
                    address and first and last name. For more information
                    vist <PaymentProviderPrivacyPolicyLink />.
                </p>
                <section className="my-3">
                    <h3>Why do we collect it?</h3>
                    <p>
                        We collect your email address for account management and
                        communication. We collect anonymous website analytics to
                        understand how people use our website.
                    </p>
                </section>
            </section>
            <section className="my-5">
                <h2>We protect and limit use of your data when you communicate directly with BeddyBytes</h2>
                <p>
                    If you voluntarily provide personal information to us directly,
                    we protect and limit its use. We will limit its use by only
                    keeping it for as long necessary for the stated purpose, and we
                    will protect it by keeping it secure and deleting it when it is
                    no longer required, unless a longer period is required by law.
                </p>
                <p>
                    Similarly, if you reach out to us directly for support, to
                    provide feedback (such as in a crash report) or for other
                    reasons, we will only use your contact information to respond to
                    you. In that process, your communication may be accessible to
                    the software-as-a-service providers we use in our corporate
                    systems (such as our company email and project management
                    software).
                </p>
            </section>
            <section className="my-5">
                <h2>We respect and support your legal privacy rights</h2>
                <p>
                    We will vigorously resist government efforts to compel us to
                    produce the very limited personal information that we might
                    have.
                </p>
                <p>
                    Related, we are based in Australia and are using AWS servers
                    in the Sydney region. As such the limited data that we do
                    collect will be stored in Australia.
                </p>
            </section>
            <section className="my-5">
                <h2>We do not sell your personal information.</h2>
                <p>We have never sold any personal information. Period.</p>
            </section>
            <section className="my-5">
                <h2>We will post a notice on this page when our policy is updated.</h2>
                <p>
                    We will notify you of changes by posting the modified version on
                    our website. We will indicate the date it was last modified
                    below with an update message on top.
                </p>
            </section>
            <section className="my-5">
                <h6>Last updated 2024-05-04</h6>
                <p>This is the first version of our privacy policy.</p>
            </section>
        </main>
    </DefaultPageWrapper>
)

export default PrivacyPolicy;

export const Head: HeadFC = () => <title>Privacy Policy - BeddyBytes</title>

/*
<section className="my-5">
    <h2>What is Personal Information and why do we collect it?</h2>
    <p>
        Personal Information is information or an opinion that identifies
        an individual. Examples of Personal Information we collect
        includes names, addresses, email addresses, phone and facsimile
        numbers.
    </p>
    <p>
        This Personal Information is obtained in many ways including by
        email, via our website beddybytes.com from third parties. We
        don't guarantee website links or policy of authorised third
        parties.
    </p>
    <p>
        We collect your Personal Information for the primary purpose of
        providing our services to you, providing information to our
        clients and marketing. We may also use your Personal Information
        for secondary purposes closely related to the primary purpose,
        in circumstances where you would reasonably expect such use or
        disclosure. You may unsubscribe from our mailing/marketing lists
        at any time by contacting us in writing.
    </p>
    <p>
        When we collect Personal Information we will, where appropriate
        and where possible, explain to you why we are collecting the
        information and how we plan to use it.
    </p>
</section>
<section className="my-5">
    <h2>Sensitive Information</h2>
    <p>
        Sensitive information is defined in the Privacy Act to include
        information or opinion about such things as an individual's
        racial or ethnic origin, political opinions, membership of a
        political association, religious or philosophical beliefs,
        membership of a trade union or other professional body, criminal
        record or health information.
    </p>
    <p>Sensitive information will be used by us only:</p>
    <ul>
        <li>For the primary purpose for which it was obtained</li>
        <li>For a secondary purpose that is directly related to the primary purpose</li>
        <li>With your consent; or where required or authorised by law.</li>
    </ul>
</section>
<section className="my-5">
    <h2>Third Parties</h2>
    <p>
        Where reasonable and practicable to do so, we will collect your
        Personal Information only from you. However, in some
        circumstances we may be provided with information by third
        parties. In such a case we will take reasonable steps to ensure
        that you are made aware of the information provided to us by
        the third party.
    </p>
</section>
<section className="my-5">
    <h2>Disclosure of Personal Information</h2>
    <p>Your Personal Information may be disclosed in a number of circumstances including the following:</p>
    <ul>
        <li>Third parties where you consent to the use or disclosure; and</li>
        <li>Where required or authorised by law.</li>
    </ul>
</section>
<section className="my-5">
    <h2>Security of Personal Information</h2>
    <p>
        Your Personal Information is stored in a manner that reasonably
        protects it from misuse and loss and from unauthorized access,
        modification or disclosure.
    </p>
    <p>
        When your Personal Information is no longer needed for the
        purpose for which it was obtained, we will take reasonable steps
        to destroy or permanently de-identify your Personal Information.
        However, most of the Personal Information is or will be stored
        in client files which will be kept by us for a minimum of 7
        years.
    </p>
</section>
*/