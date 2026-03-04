import AuthorizationService from ".";
import { save_account_to_local_storage } from "./AuthorizationClient";

export const create_account_and_login = async (authorization_service: AuthorizationService, email: string, password: string) => {
    const account = await authorization_service.authorization_client.create_account(email, password);
    const token_output = await authorization_service.authorization_client.login(email, password);
    save_account_to_local_storage(account);
    authorization_service.apply_token_output(token_output);
}

export const login = async (authorization_service: AuthorizationService, email: string, password: string) => {
    const token_output = await authorization_service.authorization_client.login(email, password);
    const account = await authorization_service.authorization_client.get_current_account(token_output.access_token);
    save_account_to_local_storage(account);
    authorization_service.apply_token_output(token_output);
}
