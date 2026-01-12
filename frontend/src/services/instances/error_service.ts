import ErrorService from "../ErrorService";
import logging_service from "./logging_service";
import authorization_service from "./authorization_service";
import { EventTypeStateChanged, ServiceStateChangedEvent } from "../Service";
import { AuthorizationServiceState } from "../AuthorizationService";

const error_service = new ErrorService({
    logging_service,
});

export default error_service;

authorization_service.addEventListener(EventTypeStateChanged, (event: ServiceStateChangedEvent<AuthorizationServiceState>) => {
    if (event.previous_state.login_required && !event.current_state.login_required) error_service.clear_errors();
});
