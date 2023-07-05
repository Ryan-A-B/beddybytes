import moment from 'moment';
import settings from './settings';

const GracePeriod = moment.duration(5, 'minutes');

export interface AccessTokenOutput {
    token_type: string
    access_token: string
    expires_in: number
}

const refreshAccessToken = async (): Promise<AccessTokenOutput> => {
    const response = await fetch(`https://${settings.API.host}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            // expects refresh token to be stored in httpOnly cookie
        }),
        credentials: 'include',
    })
    if (!response.ok) {
        const payload = await response.text()
        throw new Error(`Failed to refresh token: ${payload}`)
    }
    return response.json()
}

type AuthorizationState = "fetching" | "fetched" | "failed";

export const AuthorizationEventTypeStateChange = 'statechange';

class Authorization extends EventTarget {
    private state: AuthorizationState;
    private promise: Promise<AccessTokenOutput>;
    private expiry: moment.Moment | null = null;
    private error: Error | null = null;

    constructor() {
        super();
        this.state = "fetching";
        this.promise = refreshAccessToken();
        this.promise
            .then(this.onFetchAccessTokenSuccess)
            .catch(this.onFetchAccessTokenFailure)
    }

    private setState = (state: AuthorizationState) => {
        this.state = state;
        this.dispatchEvent(new Event(AuthorizationEventTypeStateChange));
    }

    private onFetchAccessTokenSuccess = (output: AccessTokenOutput) => {
        this.setState("fetched");
        const ttl = moment.duration(output.expires_in, 'seconds');
        this.expiry = moment().add(ttl).subtract(GracePeriod);
    }

    private onFetchAccessTokenFailure = (error: Error) => {
        this.setState("failed");
        this.error = error;
    }

    public getState = (): AuthorizationState => {
        return this.state;
    }

    public setAccessTokenOutput = (output: AccessTokenOutput) => {
        this.setState("fetched");
        const ttl = moment.duration(output.expires_in, 'seconds');
        this.expiry = moment().add(ttl).subtract(GracePeriod);
        this.promise = Promise.resolve(output);
    }

    public getAccessToken = async (): Promise<string> => {
        switch (this.state) {
            case "fetching":
                return this.promise.then((output) => output.access_token);
            case "fetched": {
                if (this.expiry === null)
                    throw new Error("expiry should not be null");
                if (moment().isAfter(this.expiry)) {
                    this.setState("fetching");
                    this.promise = refreshAccessToken();
                    this.promise
                        .then(this.onFetchAccessTokenSuccess)
                        .catch(this.onFetchAccessTokenFailure)
                    return this.promise.then((output) => output.access_token);
                }
                return this.promise.then((output) => output.access_token);
            }
            case "failed":
                throw this.error;
        }
    }
}

const authorization = new Authorization();

export default authorization;