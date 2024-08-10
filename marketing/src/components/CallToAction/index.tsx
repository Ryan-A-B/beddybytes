import React from 'react'

import "./style.scss"
import ExternalCallToAction from './ExternalCallToAction'
import InternalCallToAction from './InternalCallToAction'

export interface Props {
    click_id: string
    action: Action
}

const CallToAction: React.FunctionComponent<Props> = ({ click_id, action }) => {
    switch (action.type) {
        case "external_link":
            return <ExternalCallToAction click_id={click_id} external_link={action.external_link} />
        case "internal_link":
            return <InternalCallToAction click_id={click_id} internal_link={action.internal_link} />
        default:
            throw new Error("unsupported action type")
    }
}

export default CallToAction