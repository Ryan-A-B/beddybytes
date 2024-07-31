import React from 'react'

import "../../components/CallToAction/style.scss"

// This is duplicated, sort it out later...

const external_link = "https://square.link/u/7hK0Ut9W"

const CallToAction: React.FunctionComponent = () => (
    <div className={`call-to-action mt-3`}>
        <small>
            Use coupon code <code className="text-secondary">PAULGCONLON</code> for 80% off.
        </small>
        <br />
        <a href={external_link} target="_blank" className="btn btn-light btn-lg w-100">
            Use baby monitor
        </a>
    </div>
)

export default CallToAction