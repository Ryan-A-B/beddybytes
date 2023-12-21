import settings from '../settings';
import AuthorizationService, { EventTypeLogin, EventTypeTokenRefreshUnauthorized } from "./AuthorizationService";
import { Account } from './Account';
import Severity from './LoggingService/Severity';

export const EventTypeAccountStatusChanged = 'account_status_changed';

interface AccountStatusNoAccount {
    status: 'no_account';
}

interface AccountStatusHaveAccount {
    status: 'have_account';
    account: Account;
}

export type AccountStatus = AccountStatusNoAccount | AccountStatusHaveAccount;

const LocalStorageAccountKey = 'account';

interface NewAccountServiceInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

class AccountService extends EventTarget {
    private logging_service: LoggingService;
    private authorization_service: AuthorizationService;
    private status: AccountStatus;

    constructor(input: NewAccountServiceInput) {
        super();
        this.logging_service = input.logging_service;
        this.authorization_service = input.authorization_service;
        this.status = load_account_from_local_storage();

        this.authorization_service.addEventListener(EventTypeLogin, this.fetch_and_set_account);
        this.authorization_service.addEventListener(EventTypeTokenRefreshUnauthorized, this.clear_account);
    }

    public create_account = async (email: string, password: string): Promise<void> => {
        const access_token = await get_anonymous_token();
        const response = await fetch(`https://${settings.API.host}/accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${access_token}`
            },
            body: JSON.stringify({
                email,
                password
            }),
            credentials: 'include',
        })
        if (!response.ok) {
            const payload = await response.text()
            throw new Error(`Failed to create account: ${payload}`);
        }
        await this.authorization_service.login(email, password);
        const account = await response.json() as Account;
        this.set_account(account);
    }

    public get_status = (): AccountStatus => {
        return this.status;
    }

    private set_status = (status: AccountStatus) => {
        this.logging_service.log({
            severity: Severity.Debug,
            message: `Account status changed from ${this.status.status} to ${status.status}`,
        });
        this.status = status;
        this.dispatchEvent(new Event(EventTypeAccountStatusChanged));
    }

    private fetch_and_set_account = async (): Promise<void> => {
        const access_token = await this.authorization_service.get_access_token();
        const response = await fetch(`https://${settings.API.host}/accounts/current`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${access_token}`
            },
            credentials: 'include',
        });
        if (!response.ok) {
            const payload = await response.text()
            throw new Error(`Failed to fetch account: ${payload}`);
        }
        const account = await response.json() as Account;
        this.set_account(account);
    }

    private set_account = (account: Account): void => {
        save_account_to_local_storage(account);
        this.set_status({ status: 'have_account', account });
    }

    private clear_account = (): void => {
        remove_account_from_local_storage();
        this.set_status({ status: 'no_account' });
    }
}

export default AccountService;

const get_anonymous_token = async (): Promise<string> => {
    const tokenResponse = await fetch(`https://${settings.API.host}/anonymous_token`, {
        method: 'POST',
    })
    if (!tokenResponse.ok) {
        const payload = await tokenResponse.text()
        throw new Error(`Failed to create account: ${payload}`)
    }
    const { token_type, access_token } = await tokenResponse.json()
    if (token_type !== 'Bearer')
        throw new Error(`Failed to create account: invalid token type ${token_type}`)
    return access_token
}

const load_account_from_local_storage = (): AccountStatus => {
    const item = localStorage.getItem(LocalStorageAccountKey);
    if (item === null)
        return { status: 'no_account' };
    const account = JSON.parse(item) as Account;
    return { status: 'have_account', account };
}

const save_account_to_local_storage = (account: Account): void => {
    localStorage.setItem(LocalStorageAccountKey, JSON.stringify(account));
}

const remove_account_from_local_storage = (): void => {
    localStorage.removeItem(LocalStorageAccountKey);
}
