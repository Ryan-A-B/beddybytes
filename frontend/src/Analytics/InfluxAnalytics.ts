import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client'
import Analytics from './Analytics';
import { Duration } from 'moment';

type NewInfluxAnalyticsInput = {
    client: InfluxDB,
    org: string,
    bucket: string,
    client_id: string,
}

class InfluxAnalytics implements Analytics {
    private writer: WriteApi;

    constructor(input: NewInfluxAnalyticsInput) {
        this.writer = input.client.getWriteApi(input.org, input.bucket, 'ms');
        this.writer.useDefaultTags({
            client_id: input.client_id,
        })
    }

    public recordPageView = (page: string) => {
        const point = new Point('page_views')
            .tag('page', page)
            .intField('count', 1);
        this.writer.writePoint(point);
    }

    public recordPageViewDuration = (page: string, duration: Duration) => {
        const point = new Point('page_view_durations')
            .tag('page', page)
            .uintField('duration', duration.asMilliseconds());
        this.writer.writePoint(point);
    }
}

export default InfluxAnalytics;
