import { InfluxDB } from '@influxdata/influxdb-client'

const getOrg = (): string => {
    if (process.env.NODE_ENV !== 'production') return 'f30489c658c321d7'
    return 'creativeilk'
}

const getClient = (): InfluxDB => {
    if (process.env.NODE_ENV !== 'production') return new InfluxDB({
        url: 'https://influx.babymonitor.local:8443',
        token: 'vi3x4QTRweVCsA02Koqk1v1nhZ4b0C9ExZqz0C8ZFNrPs5npCGOt0KXkGY5L7aBXZ401K10Mbhc2yHABFH6Ljg==',
    })
    return new InfluxDB({
        url: 'https://influx.babymonitor.creativeilk.com',
        token: 'QLO7fgbno91AETkt_pUTui4y_IA7vMx8Fd8O0D4y5w1RLhTZ58sb0wRXDw_Q4jjkJiBngoFvIWszM3UdbLu_Yw==',
    })
}

export const client = getClient();
export const org = getOrg();
export const bucket = 'app';
