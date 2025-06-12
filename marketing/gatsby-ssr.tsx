import React from "react"
import { GatsbySSR } from "gatsby"

export const onRenderBody: GatsbySSR["onRenderBody"] = ({ setHeadComponents }) => {
    if (process.env.NODE_ENV !== 'production') return;
    setHeadComponents([
        <script
            key="plausible"
            data-domain="beddybytes.com"
            src="https://plausible.io/js/script.js"
            defer
        />
    ])
}