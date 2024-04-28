import React from "react"
import CallToAction from "."

const purchaseLifetimeAccess: ActionExternalLink = {
    type: "external_link",
    external_link: "https://square.link/u/7hK0Ut9W"
}

const PurchaseLifetimeAccessCallToAction: React.FunctionComponent = () => (
    <CallToAction action={purchaseLifetimeAccess} />
)

export default PurchaseLifetimeAccessCallToAction