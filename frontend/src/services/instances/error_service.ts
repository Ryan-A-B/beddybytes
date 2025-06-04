import ErrorService from "../ErrorService";
import logging_service from "./logging_service";
import authorization_service from "./authorization_service";

const error_service = new ErrorService({
    logging_service,
});

export default error_service;

authorization_service.addEventListener('statechange', (event) => {
    const state = authorization_service.get_state();
    if (state.state === 'no_account') {
        error_service.clear_errors();
    }
});
