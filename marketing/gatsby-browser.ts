import { GatsbyBrowser } from "gatsby"
import { Point } from "@influxdata/influxdb-client";
import { analytics_service } from "./src/services"

import "./src/scss/style.scss"

export const onRouteUpdate: GatsbyBrowser["onRouteUpdate"] = ({ location, prevLocation }) => {
    const point = new Point('page_view')
        .tag('path', location.pathname)
        .intField('_value', 1)
    if (prevLocation) point.tag('referrer', prevLocation.pathname)
    analytics_service.write_point(point);
}
