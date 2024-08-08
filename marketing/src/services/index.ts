import { InfluxDB } from '@influxdata/influxdb-client'
import { v4 as uuid } from "uuid";
import InfluxAnalytics from "./AnalyticsService/InfluxAnalytics";

const getClientID = (): string => {
    const key = "clientID";
    const clientID = localStorage.getItem(key);
    if (clientID !== null) return clientID;
    const newClientID = uuid();
    localStorage.setItem(key, newClientID);
    return newClientID;
}

const client_id = getClientID();
const instance_id = uuid();

const getClient = (): InfluxDB => {
    console.log(process.env.NODE_ENV !== 'production' ? 'dev' : 'prod')
    if (process.env.NODE_ENV !== 'production') return new InfluxDB({
        url: 'https://influx.beddybytes.local',
        token: 'w8f9vmyPZ91nv0NiFZ1VK7ZdFLFUXaDvHnNg0mQpVsXRmuYyaljSoc3b05LiQFCCBfw_ZFdLwLtvaMWou3Flxg==',
    })
    return new InfluxDB({
        url: 'https://influx.beddybytes.com',
        token: 'v8bGoYGG94D56UJP2uDVyxxNkynA72UQ2kyhUXRDP5JmwKlYJBHOlwUTKu4TX8q6XHuEa9PGMehx9CSvQxgJhg==',
    })
}

const client = getClient();
const org = 'beddybytes';
const bucket = 'marketing';

export const analytics_service = new InfluxAnalytics({
    client,
    org,
    bucket,
    client_id,
    instance_id,
});
