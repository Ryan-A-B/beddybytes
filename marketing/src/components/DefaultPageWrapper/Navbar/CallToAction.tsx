import React from 'react'
import { trial_signup_url, trial_signup_label } from '../../../services/trial'
import useOnClick from '../../../hooks/useOnClick'

const CallToAction: React.FunctionComponent = () => {
    const onClick = useOnClick("cta-navbar")
    return (
        <a href={trial_signup_url} onClick={onClick} className="btn btn-primary">
            {trial_signup_label}
        </a>
    )
}

export default CallToAction
