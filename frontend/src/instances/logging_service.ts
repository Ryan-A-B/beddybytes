import settings from '../settings';
import InfluxLoggingService from '../services/LoggingService/InfluxLoggingService'
import { client, org, bucket } from './influx';

const logging_service = new InfluxLoggingService({
    client,
    org,
    bucket,
    process_id: settings.API.clientID,
});

export default logging_service;
