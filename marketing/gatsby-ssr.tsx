import React from "react"
import { GatsbySSR } from "gatsby"

export const onRenderBody: GatsbySSR["onRenderBody"] = ({ setHeadComponents }) => {
    const writeToken = process.env.TINYANALYTICS_WRITE_TOKEN
    if (!writeToken) {
        console.warn("TINYANALYTICS_WRITE_TOKEN is not set. Analytics will not be sent.")
        return;
    }
    const endpoint = process.env.TINYANALYTICS_ENDPOINT || "https://analytics.beddybytes.com"
    setHeadComponents([
        <script
            key="tinyanalytics-tracker"
            defer
            src="/js/tinyanalytics-v0.autotrack.js"
            data-endpoint={endpoint}
            data-include-referrer="true"
            data-write-token={writeToken}
        />,
    ])
}
