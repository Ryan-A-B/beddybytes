import { InfluxDB, WriteApi, WritePrecisionType, Point } from "@influxdata/influxdb-client";
import { Map } from "immutable";

type NewInfluxLoggingServiceInput = {
    client: InfluxDB
    org: string
    bucket: string
    client_id: string
    instance_id: string
}

class InfluxAnalytics {
    private static WritePrecision: WritePrecisionType = 'ms';
    private writer: WriteApi;
    private default_tags: Map<string, string>;

    constructor(input: NewInfluxLoggingServiceInput) {
        this.writer = input.client.getWriteApi(input.org, input.bucket, InfluxAnalytics.WritePrecision);
        this.default_tags = Map({
            client_id: input.client_id,
            instance_id: input.instance_id,
        })
        this.writer.useDefaultTags(this.default_tags.toJS());
    }

    public set_default_tag = (key: string, value: string) => {
        this.default_tags = this.default_tags.set(key, value);
        this.writer.useDefaultTags(this.default_tags.toJS());
    }

    public write_point = (point: Point) => {
        this.writer.writePoint(point)
        this.writer.flush(true)
    }
}

export default InfluxAnalytics;
