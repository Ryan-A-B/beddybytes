import React from 'react'
import { Link } from 'gatsby'
import useOnClick from '../../hooks/useOnClick'
import { To } from './types'

interface Props {
    to: To
    color?: 'primary' | 'light'
    click_id: string
    label?: string
}

const DefaultColor = 'primary'

const CallToAction: React.FunctionComponent<Props> = ({ to, color = DefaultColor, click_id, label = 'See pricing' }) => {
    const onClick = useOnClick(click_id)
    const target = to.startsWith('#') ? undefined : '_blank'
    return (
        <div className={`call-to-action mt-3`}>
            <Link to={to} onClick={onClick} target={target} className={`btn btn-${color} btn-lg w-100`}>
                {label}
            </Link>
        </div>
    )
}

export default CallToAction
