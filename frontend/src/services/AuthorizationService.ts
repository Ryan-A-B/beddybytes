import moment from 'moment';
import settings from '../settings';
import sleep from '../utils/sleep';
import isClientError from '../utils/isClientError';
import awaitConnectionChange from '../utils/awaitNetworkChange';

export const EventTypeLogin = 'login';
export const EventTypeTokenRefreshUnauthorized = 'token_refresh_unauthorized';

const InitialRetryDelay = 1000;
const MaxRetryDelay = 5 * 60 * 1000;

const GracePeriod = moment.duration(5, 'minutes');

export interface AccessTokenOutput {
    token_type: string
    access_token: string
    expires_in: number
}

const refresh_access_token = async (retry_delay: number): Promise<AccessTokenOutput> => {
    const response = await fetch(`https://${settings.API.host}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            // expects refresh token to be stored in httpOnly cookie
        }),
        credentials: 'include',
    })
    if (isClientError(response.status))
        throw new Error(`Failed to refresh token: ${response.status} ${response.statusText}`);
    if (!response.ok) {
        await sleep(retry_delay);
        let next_retry_delay = retry_delay * 2;
        if (next_retry_delay > MaxRetryDelay)
            next_retry_delay = MaxRetryDelay;
        return refresh_access_token(next_retry_delay);
    }
    return response.json()
}

interface AuthorizationStateNotFetched {
    state: 'not_fetched'
}

interface AuthorizationStateFetching {
    state: 'fetching'
    promise: Promise<AccessTokenOutput>
}

interface AuthorizationStateFetched {
    state: 'fetched'
    expiry: moment.Moment
    access_token: string
}

interface AuthorizationStateFailed {
    state: 'failed'
    error: Error
}

type AuthorizationState = AuthorizationStateNotFetched | AuthorizationStateFetching | AuthorizationStateFetched | AuthorizationStateFailed;

class AuthorizationService extends EventTarget {
    private state: AuthorizationState;

    constructor() {
        super();
        this.state = { state: 'not_fetched' };
    }

    public login = async (email: string, password: string): Promise<void> => {
        const response = await fetch(`https://${settings.API.host}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'password',
                username: email,
                password,
            }),
            credentials: 'include',
        })
        if (isClientError(response.status))
            throw new Error(`Failed to login: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            const payload = await response.text()
            throw new Error(`Failed to login: ${payload}`)
        }
        const output = await response.json() as AccessTokenOutput;
        this.state = {
            state: "fetched",
            expiry: moment().add(output.expires_in, 'seconds').subtract(GracePeriod),
            access_token: output.access_token,
        };
        this.dispatchEvent(new Event(EventTypeLogin));
    }

    public get_access_token = async (): Promise<string> => {
        switch (this.state.state) {
            case "not_fetched":
                return this.refresh_access_token();
            case "fetching":
                return this.state.promise.then((output) => output.access_token);
            case "fetched": {
                if (moment().isAfter(this.state.expiry))
                    return this.refresh_access_token();
                return this.state.access_token;
            }
            case "failed":
                throw this.state.error;
        }
    }

    private refresh_access_token = async (): Promise<string> => {
        this.state = {
            state: "fetching",
            promise: refresh_access_token(InitialRetryDelay)
        };
        this.state.promise
            .then(this.on_fetch_access_token_success)
            .catch(this.on_fetch_access_token_failure);
        return this.state.promise.then((output) => output.access_token);
    }

    private on_fetch_access_token_success = (output: AccessTokenOutput) => {
        const ttl = moment.duration(output.expires_in, 'seconds');
        this.state = {
            state: "fetched",
            expiry: moment().add(ttl).subtract(GracePeriod),
            access_token: output.access_token,
        };
    }

    private on_fetch_access_token_failure = (error: Error) => {
        // TODO if error is 401, dispatch token_refresh_unauthorized event
        this.state = {
            state: "failed",
            error,
        };
    }
}

export default AuthorizationService;