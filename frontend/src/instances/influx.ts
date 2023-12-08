import { InfluxDB } from '@influxdata/influxdb-client'

const getOrg = (): string => {
    if (process.env.NODE_ENV !== 'production') return 'f30489c658c321d7'
    return 'creativeilk'
}

const getClient = (): InfluxDB => {
    if (process.env.NODE_ENV !== 'production') return new InfluxDB({
        url: 'https://influx.babymonitor.local:8443',
        token: '1iA4Zsc1XAAw9vZprfHAnojjkPLE_9Ghm9mWH0yTEqgUbRBM3jc--JxIz0_3y-brA-fha3cJ2YqTa0maVRaSeQ==',
    })
    return new InfluxDB({
        url: 'https://influx.babymonitor.creativeilk.com',
        token: 'QLO7fgbno91AETkt_pUTui4y_IA7vMx8Fd8O0D4y5w1RLhTZ58sb0wRXDw_Q4jjkJiBngoFvIWszM3UdbLu_Yw==',
    })
}

export const client = getClient();
export const org = getOrg();
export const bucket = 'app';
