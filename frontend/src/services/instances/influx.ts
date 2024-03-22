import { InfluxDB } from '@influxdata/influxdb-client'

const getClient = (): InfluxDB => {
    if (process.env.NODE_ENV !== 'production') return new InfluxDB({
        url: 'https://influx.beddybytes.local',
        token: '89X2G06CruyZ1lPpMAOhd_VzjuXiNhkQ1wOy27U_gfkIqXjqmYKK32BSVvgIDSyGFclijF2b1HVKBVN6k6XeeA==',
    })
    return new InfluxDB({
        url: 'https://influx.beddybytes.com',
        token: 'q4v2Oq_mdvvT9AheFq-FgtZ9HGUQJ-D6R8ilVEkVa4D5rdjlrEdo3IhMNOTLyJ0YQcVKuV9of968-MmmV2xVuw==',
    })
}

export const client = getClient();
export const org = 'beddybytes';
export const bucket = 'app';
