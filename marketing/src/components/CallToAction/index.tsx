import React from 'react'
import useOnClick from '../../hooks/useOnClick'
import { trial_signup_url, trial_signup_label } from '../../services/trial'

interface Props {
    color?: 'primary' | 'light'
    click_id: string
}

const DefaultColor = 'primary'

const CallToAction: React.FunctionComponent<Props> = ({ color = DefaultColor, click_id }) => {
    const onClick = useOnClick(click_id)
    return (
        <div className={`call-to-action mt-3`}>
            <a href={trial_signup_url} onClick={onClick} className={`btn btn-${color} btn-lg w-100`}>
                {trial_signup_label}
            </a>
        </div>
    )
}

export default CallToAction
