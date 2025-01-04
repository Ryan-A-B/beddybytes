import { InfluxDB } from '@influxdata/influxdb-client'

const getClient = (): InfluxDB => {
    if (process.env.NODE_ENV !== 'production') return new InfluxDB({
        url: 'https://influx.beddybytes.local',
        token: '89X2G06CruyZ1lPpMAOhd_VzjuXiNhkQ1wOy27U_gfkIqXjqmYKK32BSVvgIDSyGFclijF2b1HVKBVN6k6XeeA==',
    })
    return new InfluxDB({
        url: 'https://influxdb.beddybytes.com',
        token: '7YVbDqZErhr8XFS2dCMFR-hD1T9OmblkeKMMB2rlwNaKaV7k3XkqiQNUUv9XyKu7HH_s-qK9tPjMyEicubpx1w==',
    })
}

export const client = getClient();
export const org = 'beddybytes';
export const bucket = 'app';
