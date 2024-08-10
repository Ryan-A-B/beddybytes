import React from "react"
import CallToAction from "."

const purchaseOneYearAccess: ActionExternalLink = {
    type: "external_link",
    external_link: "https://square.link/u/qz0OYi34"
}

const PurchaseOneYearAccessCallToAction: React.FunctionComponent = () => (
    <CallToAction click_id="cta-purchase-one-year" action={purchaseOneYearAccess} />
)

export default PurchaseOneYearAccessCallToAction