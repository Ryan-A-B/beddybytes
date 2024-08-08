import { InfluxDB, WriteApi, WritePrecisionType, Point } from "@influxdata/influxdb-client";

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

    constructor(input: NewInfluxLoggingServiceInput) {
        this.writer = input.client.getWriteApi(input.org, input.bucket, InfluxAnalytics.WritePrecision);
        this.writer.useDefaultTags({
            client_id: input.client_id,
            instance_id: input.instance_id,
        });
    }

    public write_point = (point: Point) => {
        this.writer.writePoint(point)
        this.writer.flush()
    }
}

export default InfluxAnalytics;
