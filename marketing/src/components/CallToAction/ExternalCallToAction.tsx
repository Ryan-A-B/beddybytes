import React from 'react'

import "./style.scss"

interface Props {
    external_link: string
}

// There's duplication with InternalCallToAction, sort it out later...

const CallToAction: React.FunctionComponent<Props> = ({ external_link }) => (
    <div className={`call-to-action mt-3`}>
        <small>
            Use coupon code <code>EARLYACCESS</code> for 70% off.
        </small>
        <br />
        <a href={external_link} target="_blank" className="btn btn-primary btn-lg w-100">
            Use baby monitor
        </a>
    </div>
)

export default CallToAction