import React from "react"
import { GatsbySSR } from "gatsby"

export const onRenderBody: GatsbySSR["onRenderBody"] = ({ setHeadComponents }) => {
    const endpoint = process.env.TINYANALYTICS_ENDPOINT || "https://analytics.beddybytes.com"
    const writeToken = process.env.TINYANALYTICS_WRITE_TOKEN

    setHeadComponents([
        <script
            key="tinyanalytics-tracker"
            defer
            src="/js/tinyanalytics-v0.autotrack.js"
            data-endpoint={endpoint}
            data-include-referrer="true"
            {...(writeToken ? { "data-write-token": writeToken } : {})}
        />,
    ])
}
