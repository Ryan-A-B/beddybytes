import { EventTypeStateChanged, ServiceStateChangedEvent } from "../Service";
import { load_account_from_local_storage } from "../AuthorizationService/AuthorizationClient";
import authorization_service from "./authorization_service";
import { AuthorizationServiceState } from "../AuthorizationService";

// TODO access token availability is being used as a proxy for account presence
// We should make this explicit

const handle_authorization_service_state_changed = (event: ServiceStateChangedEvent<AuthorizationServiceState>): void => {
    const access_token_became_available = !event.previous_state.access_token_available && event.current_state.access_token_available;
    if (!access_token_became_available) return;
    authorization_service.removeEventListener(EventTypeStateChanged, handle_authorization_service_state_changed);
    const account = load_account_from_local_storage();
    if (account === null) return; // TODO this shouldn't happen
    if (account.license.type !== 'trial') return;
    const expiry_millis = account.license.trial_detail.end_unix_seconds * 1000;
    if (expiry_millis <= Date.now()) return;
    refresh_token_on_trial_expiry(expiry_millis);
};

const refresh_token_on_trial_expiry = (expiry_millis: number): void => {
    const interval_handle = setInterval(() => {
        const now = Date.now();
        if (expiry_millis > now) return;
        clearInterval(interval_handle);
        handle_trial_expiry();
    }, 60 * 1000);
};

const handle_trial_expiry = (): void => {
    authorization_service.refresh_token();
};

authorization_service.addEventListener(EventTypeStateChanged, handle_authorization_service_state_changed);