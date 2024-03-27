import { InfluxDB } from '@influxdata/influxdb-client'

const getClient = (): InfluxDB => {
    if (process.env.NODE_ENV !== 'production') return new InfluxDB({
        url: 'https://influx.beddybytes.local',
        token: '89X2G06CruyZ1lPpMAOhd_VzjuXiNhkQ1wOy27U_gfkIqXjqmYKK32BSVvgIDSyGFclijF2b1HVKBVN6k6XeeA==',
    })
    return new InfluxDB({
        url: 'https://influx.beddybytes.com',
        token: 'QWPp6p0hcgPozmUDKfb6dgEpbcmugF98nkSqtCsZfDxt8iHZJ6Ky-IDaZwsCKC7wUPIvKagoF5eExaECks9BBw==',
    })
}

export const client = getClient();
export const org = 'beddybytes';
export const bucket = 'app';
