import AuthorizationService from '../AuthorizationService';
import AuthorizationClientHTTP from '../AuthorizationService/AuthorizationClientHTTP';
import logging_service from './logging_service';

const authorization_service = new AuthorizationService({
    logging_service,
    authorization_client: new AuthorizationClientHTTP({
        logging_service,
    }),
});

export default authorization_service;