import React from 'react'
import useOnClick from '../../hooks/useOnClick'
import "./style.scss"

interface Props {
    click_id: string
    external_link: string
}

// There's duplication with InternalCallToAction, sort it out later...

const CallToAction: React.FunctionComponent<Props> = ({ click_id, external_link }) => {
    const onClick = useOnClick(click_id)
    return (
        <div className={`call-to-action mt-3`}>
            <small>
                Use coupon code <code>EARLYACCESS</code> for 70% off.
            </small>
            <br />
            <a href={external_link} onClick={onClick} target="_blank" className="btn btn-primary btn-lg w-100">
                Use baby monitor
            </a>
        </div>
    )
}

export default CallToAction