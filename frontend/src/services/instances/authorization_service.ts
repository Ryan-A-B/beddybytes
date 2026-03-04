import AuthorizationService from '../AuthorizationService';
import AuthorizationClientHTTP from '../AuthorizationService/AuthorizationClientHTTP';
import { load_account_from_local_storage } from '../AuthorizationService/AuthorizationClient';
import { AuthorizationServiceState } from '../AuthorizationService';
import { EventTypeStateChanged, ServiceStateChangedEvent } from '../Service';
import logging_service from './logging_service';

const NoAccountID = 'no account';

const sync_logging_service_account_id = (): void => {
    const account = load_account_from_local_storage();
    if (account === null) {
        logging_service.set_account_id(NoAccountID);
        return;
    }
    logging_service.set_account_id(account.id);
}

const authorization_service = new AuthorizationService({
    logging_service,
    authorization_client: new AuthorizationClientHTTP({
        logging_service,
    }),
});

sync_logging_service_account_id();

authorization_service.addEventListener(EventTypeStateChanged, (event: ServiceStateChangedEvent<AuthorizationServiceState>) => {
    if (event.current_state.login_required) {
        logging_service.set_account_id(NoAccountID);
        return;
    }
    sync_logging_service_account_id();
});

export default authorization_service;
