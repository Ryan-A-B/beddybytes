import React from 'react'

// https://www.nanit.com/policies/privacy-policy#person-information-we-collect

const NanitPrivacyPolicySnippet: React.FunctionComponent = () => {
    return (
        <blockquote className="blockquote fs-6">
            <h4 className="card-subtitle">
                PERSONAL INFORMATION WE COLLECT
            </h4>
            <p>
                We collect information from you when you use our camera, related products, and applications,
                such as full name, email address, country location, phone number, profile picture, user's
                time zone, wifi network name, IP address, humidity and temperature of the baby's room,
                <strong>video recording of crib environment</strong>, usage information, geolocation to
                enable Bluetooth pairing, baby name, baby profile image, baby gender, baby date of birth,
                and any other data that you provide/supply including pictures, video clips and Customer inputs.
            </p>
            <footer className="blockquote-footer">
                <cite>Creepy Baby Monitor Privacy Policy</cite>
            </footer>
        </blockquote>
    )
}

export default NanitPrivacyPolicySnippet

