import { InfluxDB } from '@influxdata/influxdb-client'

const getClient = (): InfluxDB => {
    if (process.env.NODE_ENV !== 'production') return new InfluxDB({
        url: 'https://influx.babymonitor.local',
        token: '1iA4Zsc1XAAw9vZprfHAnojjkPLE_9Ghm9mWH0yTEqgUbRBM3jc--JxIz0_3y-brA-fha3cJ2YqTa0maVRaSeQ==',
    })
    return new InfluxDB({
        url: 'https://influx.babymonitor.creativeilk.com',
        token: 'vi3x4QTRweVCsA02Koqk1v1nhZ4b0C9ExZqz0C8ZFNrPs5npCGOt0KXkGY5L7aBXZ401K10Mbhc2yHABFH6Ljg==',
    })
}

export const client = getClient();
export const org = 'creativeilk';
export const bucket = 'app';
