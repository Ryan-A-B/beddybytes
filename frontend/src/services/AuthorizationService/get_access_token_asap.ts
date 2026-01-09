import AuthorizationService from ".";
import { wait_for_state_change } from "../Service";

// For callers who ask for an access token before the user has logged in
const get_access_token_asap = async (authorization_service: AuthorizationService): Promise<string> => {
    let authorization_state = authorization_service.get_state();
    while (!authorization_state.access_token_available) {
        authorization_state = await wait_for_state_change(authorization_service);
    }
    return authorization_state.get_access_token();
};

export default get_access_token_asap;