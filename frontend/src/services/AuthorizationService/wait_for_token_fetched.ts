import { EventTypeStateChanged } from "../Service";
import { AuthorizationService } from "./types";

const wait_for_token_fetched = async (authorization_service: AuthorizationService) => new Promise<void>((resolve, reject) => {
    const state = authorization_service.get_state();
    if (state.state === 'token_fetched') {
        resolve();
        return;
    }
    const handle_state_changed = () => {
        const state = authorization_service.get_state();
        if (state.state === 'token_fetched') {
            authorization_service.removeEventListener(EventTypeStateChanged, handle_state_changed);
            resolve();
        }
    }
    authorization_service.addEventListener(EventTypeStateChanged, handle_state_changed);
})

export default wait_for_token_fetched;
