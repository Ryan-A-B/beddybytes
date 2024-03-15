import moment from 'moment';

import settings from '../../settings';
import isClientError from '../../utils/isClientError';
import Severity from '../LoggingService/Severity';
import sleep from '../../utils/sleep';

const InitialRetryDelay = 1000;
const MaxRetryDelay = 5 * 60 * 1000;

const GracePeriod = moment.duration(5, 'minutes');

type NewAuthorizationServiceInput = {
    logging_service: LoggingService;
}

class AuthorizationService extends EventTarget implements AuthorizationService {
    private logging_service: LoggingService;
    private state: AuthorizationState;

    constructor(input: NewAuthorizationServiceInput) {
        super();
        this.logging_service = input.logging_service;
        const account = load_account_from_local_storage();
        if (account === null) {
            this.state = { state: 'no_account' };
            return;
        }
        this.state = { state: 'token_not_fetched', account };
    }

    public get_state = (): AuthorizationState => {
        return this.state;
    }

    private set_state(state: AuthorizationState): void {
        this.state = state;
        this.dispatchEvent(new Event('statechange'))
    }

    private set_token_fetched_state = (account: Account, token_output: TokenOutput): void => {
        this.set_state({
            state: 'token_fetched',
            account,
            access_token: token_output.access_token,
            expiry: moment().add(token_output.expires_in, 'seconds').add(-GracePeriod),
        });
    }

    public create_account_and_login = async (email: string, password: string): Promise<void> => {
        if (this.state.state !== 'no_account')
            throw new Error('already have account');
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
        });
        if (!response.ok) {
            const payload = await response.text();
            throw new Error(`Failed to create account: ${payload}`);
        }
        const token_output = await login(email, password);
        const account = await response.json() as Account;
        save_account_to_local_storage(account);
        this.set_token_fetched_state(account, token_output);
    }

    public login = async (email: string, password: string): Promise<void> => {
        if (this.state.state !== 'no_account')
            throw new Error('already have account');
        const token_output = await login(email, password);
        const account = await get_current_account(token_output.access_token);
        save_account_to_local_storage(account);
        this.set_token_fetched_state(account, token_output);
    }

    public get_access_token = async (): Promise<string> => {
        switch (this.state.state) {
            case 'no_account': throw new Error('no account');
            case 'token_not_fetched': {
                const token_output = await this.refresh_token();
                return token_output.access_token;
            }
            case 'refreshing_token': {
                const token_output = await this.state.promise;
                return token_output.access_token;
            }
            case 'token_fetched': {
                if (moment().isAfter(this.state.expiry)) {
                    const token_output = await this.refresh_token();
                    return token_output.access_token;
                }
                return this.state.access_token;
            }
        }
    }

    private refresh_token = async (): Promise<TokenOutput> => {
        if (this.state.state !== 'token_not_fetched' && this.state.state !== 'token_fetched')
            throw new Error('invalid state');
        const promise = refresh_token_with_retry(this.logging_service, InitialRetryDelay);
        this.set_state({
            state: 'refreshing_token',
            account: this.state.account,
            promise,
        });
        try {
            const token_output = await promise;
            this.set_token_fetched_state(this.state.account, token_output);
            return token_output;
        } catch (error) {
            remove_account_from_local_storage();
            this.set_state({ state: 'no_account' });
            throw error;
        }
    }
}

export default AuthorizationService;

const LocalStorageAccountKey = 'account';

const load_account_from_local_storage = (): Optional<Account> => {
    const item = localStorage.getItem(LocalStorageAccountKey);
    if (item === null) return null;
    const account = JSON.parse(item) as Account;
    return account;
}

const save_account_to_local_storage = (account: Account): void => {
    localStorage.setItem(LocalStorageAccountKey, JSON.stringify(account));
}

const remove_account_from_local_storage = (): void => {
    localStorage.removeItem(LocalStorageAccountKey);
}

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

const login = async (email: string, password: string): Promise<TokenOutput> => {
    const response = await fetch(`https://${settings.API.host}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'password',
            username: email,
            password,
        }),
        // include credentials to receive httpOnly cookie
        credentials: 'include',
    })
    if (isClientError(response.status))
        throw new Error(`Failed to login: ${response.status} ${response.statusText}`);
    if (!response.ok) {
        const payload = await response.text()
        throw new Error(`Failed to login: ${payload}`)
    }
    return await response.json() as TokenOutput;
}

const get_current_account = async (access_token: string): Promise<Account> => {
    const response = await fetch(`https://${settings.API.host}/accounts/current`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
    });
    if (!response.ok) {
        const payload = await response.text()
        throw new Error(`Failed to fetch account: ${payload}`);
    }
    return await response.json() as Account;
}

class ClientError extends Error {
    public constructor(status: number, statusText: string) {
        super(`Failed to refresh token: ${status} ${statusText}`);
    }
}

const refresh_token = async (logging_service: LoggingService): Promise<TokenOutput> => {
    logging_service.log({
        severity: Severity.Informational,
        message: `Refreshing token`
    })
    const response = await fetch(`https://${settings.API.host}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            // expects refresh token to be stored in httpOnly cookie
        }),
        // include credentials to send httpOnly cookie
        credentials: 'include',
    });
    if (isClientError(response.status))
        throw new ClientError(response.status, response.statusText);
    if (!response.ok)
        throw new Error(`Failed to refresh token: ${response.status} ${response.statusText}`);
    return response.json();
}

const refresh_token_with_retry = async (logging_service: LoggingService, retry_delay: number): Promise<TokenOutput> => {
    try {
        return await refresh_token(logging_service);
    } catch (error) {
        if (error instanceof ClientError)
            throw error;
        const isError = error instanceof Error;
        if (!isError)
            throw error;
        logging_service.log({
            severity: Severity.Warning,
            message: `Failed to refresh token: ${error.message}, retrying in ${retry_delay}ms`
        })
        await sleep(retry_delay);
        let next_retry_delay = retry_delay * 2;
        if (next_retry_delay > MaxRetryDelay)
            next_retry_delay = MaxRetryDelay;
        return refresh_token_with_retry(logging_service, next_retry_delay);
    }
}
