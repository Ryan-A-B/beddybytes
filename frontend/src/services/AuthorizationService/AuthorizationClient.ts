import { Account } from "./Account";

export interface AuthorizationClient {
    login(email: string, password: string): Promise<TokenOutput>;
    refresh_token(): Promise<TokenOutput>;
    refresh_token_with_retry(retry_delay: number): Promise<TokenOutput>;

    // TODO is there a better place for these to live?
    create_account(email: string, password: string): Promise<Account>;
    get_current_account(access_token: string): Promise<Account>;
    request_password_reset(email: string): Promise<void>;
    reset_password(input: ResetPasswordInput): Promise<void>;
}

export interface TokenOutput {
    token_type: string;
    access_token: string;
    expires_in: number;
}

export interface ResetPasswordInput {
    token: string;
    password: string;
}

const LocalStorageAccountKey = 'account';

export const load_account_from_local_storage = (): Optional<Account> => {
    const item = localStorage.getItem(LocalStorageAccountKey);
    if (item === null) return null;
    const account = JSON.parse(item) as Account;
    return account;
}

export const save_account_to_local_storage = (account: Account): void => {
    localStorage.setItem(LocalStorageAccountKey, JSON.stringify(account));
}

export const remove_account_from_local_storage = (): void => {
    localStorage.removeItem(LocalStorageAccountKey);
}