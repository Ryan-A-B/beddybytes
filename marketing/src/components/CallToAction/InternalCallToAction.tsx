import React from 'react'
import { Link } from 'gatsby'
import useOnClick from '../../hooks/useOnClick'
import "./style.scss"

interface Props {
    click_id: string
    internal_link: string
}

// There's duplication with ExternalCallToAction, sort it out later...

const CallToAction: React.FunctionComponent<Props> = ({ click_id, internal_link }) => {
    const onClick = useOnClick(click_id)
    return (
        <Link to={internal_link} onClick={onClick} target="_blank" className="btn btn-primary btn-lg w-100">
            Use baby monitor
        </Link>
    )
}

export default CallToAction