import React from "react"
import { GatsbySSR } from "gatsby"

const domain = (() => {
    if (process.env.NODE_ENV !== 'production')
        return "beddybytes.local"
    return "beddybytes.com"
})()

export const onRenderBody: GatsbySSR["onRenderBody"] = ({ setHeadComponents }) => {
    setHeadComponents([
        <script
            key="plausible"
            data-domain={domain}
            src="https://plausible.io/js/script.js"
            defer
        />
    ])
}