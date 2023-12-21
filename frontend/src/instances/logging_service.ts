import settings from '../settings';
import InfluxLoggingService from '../services/LoggingService/InfluxLoggingService'
import { client, org, bucket } from './influx';
import instance_id from './instance_id';
import CompositeLoggingService from '../services/LoggingService/CompositeLoggingService';
import ConsoleLoggingService from '../services/LoggingService/ConsoleLoggingService';

const influx_logging_service = new InfluxLoggingService({
    client,
    org,
    bucket,
    client_id: settings.API.clientID,
    instance_id,
});

const logging_service = new CompositeLoggingService([
    new ConsoleLoggingService(),
    influx_logging_service,
])

export default logging_service;
