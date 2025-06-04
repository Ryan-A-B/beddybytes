import ErrorService from "../ErrorService";
import logging_service from "./logging_service";
import authorization_service from "./authorization_service";

const error_service = new ErrorService({
    logging_service,
});

export default error_service;

let last_authorization_state = authorization_service.get_state();
authorization_service.addEventListener('statechange', (event) => {
    const state = authorization_service.get_state();
    if (last_authorization_state.state === 'no_account' && state.state === 'token_fetched') error_service.clear_errors();
    last_authorization_state = state;
});
