import React from 'react'
import { Link } from 'gatsby'
import useOnClick from '../../../hooks/useOnClick'

const CallToAction: React.FunctionComponent = () => {
    const onClick = useOnClick("cta-navbar")
    return (
        <Link to="/pricing" onClick={onClick} className="btn btn-primary">
            See pricing
        </Link>
    )
}

export default CallToAction
