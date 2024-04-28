import React from 'react'

import "./style.scss"
import ExternalCallToAction from './ExternalCallToAction'
import InternalCallToAction from './InternalCallToAction'

interface Props {
    action: Action
}

const CallToAction: React.FunctionComponent<Props> = ({ action }) => {
    switch (action.type) {
        case "external_link":
            return <ExternalCallToAction external_link={action.external_link} />
        case "internal_link":
            return <InternalCallToAction internal_link={action.internal_link} />
        default:
            throw new Error("unsupported action type")
    }
}

export default CallToAction