import AuthorizationService from '../AuthorizationService';
import influx_logging_service from './logging_service';

const authorization_service = new AuthorizationService({
    logging_service: influx_logging_service,
});

export default authorization_service;