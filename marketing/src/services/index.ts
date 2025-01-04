import { InfluxDB } from '@influxdata/influxdb-client'
import { v4 as uuid } from "uuid";
import InfluxAnalytics from "./AnalyticsService/InfluxAnalytics";

const getClientID = (): string => {
    if (typeof localStorage === 'undefined') return uuid();
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
        url: 'https://influxdb.beddybytes.com',
        token: 'LgpjMj50B3_ZkFV2Nt21q_TNmWvT8fZYc9v8rMYoWcYYS577SGyBexebhhU2cq9Pz0LwcL9f98nc8SxRpyzfxg==',
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
