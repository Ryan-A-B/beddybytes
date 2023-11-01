import { InfluxDB, Point, HttpError, WriteApi } from '@influxdata/influxdb-client'
import Analytics from './Analytics';
import { Duration } from 'moment';

const getClient = (): InfluxDB => {
    if (process.env.NODE_ENV !== 'production') return new InfluxDB({
        url: 'https://influx.babymonitor.local:8443',
        token: '1iA4Zsc1XAAw9vZprfHAnojjkPLE_9Ghm9mWH0yTEqgUbRBM3jc--JxIz0_3y-brA-fha3cJ2YqTa0maVRaSeQ==',
    })
    throw new Error('Influx host not set');
}

class InfluxAnalytics implements Analytics {
    private writer: WriteApi;

    constructor(client_id: string) {
        console.log('Initializing Influx analytics');
        const org = 'f30489c658c321d7';
        const bucket = 'app';
        this.writer = getClient().getWriteApi(org, bucket, 'ms');
        this.writer.useDefaultTags({
            client_id,
        })
    }

    public recordPageView = (page: string) => {
        console.log(`Recording page view for ${page}`)
        const point = new Point('page_views')
            .tag('page', page)
            .intField('count', 1);
        this.writer.writePoint(point);
    }

    public recordPageViewDuration = (page: string, duration: Duration) => {
        console.log(`Recording page view duration for ${page}`)
        const point = new Point('page_view_durations')
            .tag('page', page)
            .uintField('duration', duration.asMilliseconds());
        this.writer.writePoint(point);
    }
}

export default InfluxAnalytics;
