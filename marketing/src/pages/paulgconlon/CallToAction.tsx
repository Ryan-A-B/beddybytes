import React from 'react'

import "../../components/CallToAction/style.scss"

// This is duplicated, sort it out later...

const external_link = "https://square.link/u/7hK0Ut9W"

interface Props {
    button_color?: string;
}

const CallToAction: React.FunctionComponent<Props> = ({ button_color = "light" }) => (
    <div className={`call-to-action mt-3`}>
        <small>
            Use coupon code <code className="text-secondary">PAULGCONLON</code> for 80% off.
        </small>
        <br />
        <a href={external_link} target="_blank" className={`btn btn-${button_color} btn-lg w-100`}>
            Don't miss out!
        </a>
    </div>
)

export default CallToAction