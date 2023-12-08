import settings from '../settings';
import InfluxAnalytics from './InfluxAnalytics';
import { bucket, client, org } from '../instances/influx';

const analytics = new InfluxAnalytics({
    client,
    org,
    bucket,
    client_id: settings.API.clientID,
});

export default analytics;
