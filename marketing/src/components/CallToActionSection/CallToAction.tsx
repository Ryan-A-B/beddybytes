import React from 'react'
import useOnClick from '../../hooks/useOnClick'
import "../CallToAction/style.scss"

// This is duplicated, sort it out later...

const external_link = "https://square.link/u/7hK0Ut9W"

const CallToAction: React.FunctionComponent = () => {
    const onClick = useOnClick("cta-cta-section")
    return (
        <div className={`call-to-action mt-3`}>
            <small>
                Use coupon code <code>EARLYACCESS</code> for 70% off.
            </small>
            <br />
            <a href={external_link} onClick={onClick} target="_blank" className="btn btn-light btn-lg w-100">
                Use baby monitor
            </a>
        </div>
    )
}

export default CallToAction