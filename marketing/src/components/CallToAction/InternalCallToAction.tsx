import React from 'react'
import { Link } from 'gatsby'

import "./style.scss"

interface Props {
    internal_link: string
}

// There's duplication with ExternalCallToAction, sort it out later...

const CallToAction: React.FunctionComponent<Props> = ({ internal_link }) => (
    <Link to={internal_link} target="_blank" className="btn btn-primary btn-lg w-100">
        Use baby monitor
    </Link>
)

export default CallToAction