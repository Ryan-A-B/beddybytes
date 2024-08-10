import React from "react";
import { Point } from "@influxdata/influxdb-client";
import { analytics_service } from "../services";

const useOnClick = (id: string) => {
    return React.useCallback(() => {
        const point = new Point("click")
            .tag("id", id)
            .intField("_value", 1)
        analytics_service.write_point(point)
    }, [id])
}

export default useOnClick;