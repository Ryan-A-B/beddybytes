import React from 'react'
import { trial_signup_url, trial_signup_label } from '../../services/trial'

interface Props {
    color?: 'primary' | 'light'
    click_id: string
}

const DefaultColor = 'primary'

const CallToAction: React.FunctionComponent<Props> = ({ color = DefaultColor, click_id }) => {
    return (
        <div className={`call-to-action mt-3`}>
            <a href={trial_signup_url} className={`btn btn-${color} btn-lg w-100`}>
                {trial_signup_label}
            </a>
        </div>
    )
}

export default CallToAction
