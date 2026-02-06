import moment from "moment";
import LoggingService, { Severity } from '../LoggingService';
import { AuthorizationClient, load_account_from_local_storage, remove_account_from_local_storage, TokenOutput } from "./AuthorizationClient";
import Service from "../Service";

const InitialRetryDelay = 1000;

const GracePeriod = moment.duration(5, 'minutes');

interface ServiceProxy {
    logging_service: LoggingService;
    authorization_client: AuthorizationClient;
    set_state(state: AuthorizationServiceState): void;
    refresh_token(): void;
    handle_refresh_token_success(token_output: TokenOutput): void;
    handle_refresh_token_failure(): void;
}

abstract class AbstractState {
    public abstract readonly name: string;
    public abstract readonly access_token_available: boolean;
    public abstract readonly login_required: boolean;

    public get_access_token = (): string => {
        throw new Error(`can not get access token in ${this.name} state`);
    };

    public apply_token_output = (proxy: ServiceProxy, token_output: TokenOutput): void => {
        proxy.logging_service.log({
            severity: Severity.Error,
            message: `Attempted to apply token output in ${this.name} state`
        });
    }

    public refresh_token_if_needed = (proxy: ServiceProxy): void => {
        // default is to do nothing
    }

    public refresh_token = async (proxy: ServiceProxy): Promise<void> => {
        proxy.logging_service.log({
            severity: Severity.Error,
            message: `Attempted to refresh token in ${this.name} state`
        });
    };

    public handle_refresh_token_success = (proxy: ServiceProxy, token_output: TokenOutput): void => {
        // ignore
    };

    public handle_refresh_token_failure = (proxy: ServiceProxy): void => {
        // ignore
    };
}

class Unauthorized extends AbstractState {
    public readonly name = 'Unauthorized';
    public readonly access_token_available = false;
    public readonly login_required = true;

    apply_token_output = (proxy: ServiceProxy, token_output: TokenOutput): void => {
        const access_token_expiry = moment().add(token_output.expires_in, 'seconds').add(-GracePeriod);
        proxy.set_state(new Authorized(token_output.access_token, access_token_expiry));
    }
}

class RefreshingForNewSession extends AbstractState {
    public readonly name = 'RefreshingForNewSession';
    public readonly access_token_available = false;
    public readonly login_required = false;

    handle_refresh_token_success = (proxy: ServiceProxy, token_output: TokenOutput) => {
        const access_token_expiry = moment().add(token_output.expires_in, 'seconds').add(-GracePeriod);
        proxy.set_state(new Authorized(token_output.access_token, access_token_expiry));
    }

    handle_refresh_token_failure = (proxy: ServiceProxy): void => {
        // likely their refresh token has expired
        proxy.set_state(new Unauthorized());
        remove_account_from_local_storage();
    }
}

class Authorized extends AbstractState {
    public readonly name = 'Authorized';
    public readonly access_token_available = true;
    public readonly login_required = false;
    private readonly access_token: string;
    private readonly access_token_expiry: moment.Moment;

    constructor(access_token: string, access_token_expiry: moment.Moment) {
        super();
        this.access_token = access_token;
        this.access_token_expiry = access_token_expiry;
    }

    get_access_token = (): string => {
        return this.access_token;
    }

    refresh_token = async (proxy: ServiceProxy): Promise<void> => {
        proxy.set_state(new RefreshingToContinueSession(this.access_token));
        try {
            const token_output = await proxy.authorization_client.refresh_token_with_retry(InitialRetryDelay);
            proxy.handle_refresh_token_success(token_output);
        } catch (error) {
            proxy.handle_refresh_token_failure();
        }
    }

    refresh_token_if_needed = (proxy: ServiceProxy): void => {
        const now = moment();
        if (now.isBefore(this.access_token_expiry)) {
            // token is still valid
            return;
        }
        // token has expired, refresh it
        proxy.refresh_token();
    }
}

class RefreshingToContinueSession extends AbstractState {
    public readonly name = 'RefreshingToContinueSession';
    public readonly access_token_available = true;
    public readonly login_required = false;
    private readonly access_token: string;

    constructor(access_token: string) {
        super();
        this.access_token = access_token;
    }

    get_access_token = (): string => {
        return this.access_token;
    }

    handle_refresh_token_success = (proxy: ServiceProxy, token_output: TokenOutput) => {
        const access_token_expiry = get_access_token_expiry(token_output.expires_in);
        proxy.set_state(new Authorized(token_output.access_token, access_token_expiry));
    }

    handle_refresh_token_failure = (proxy: ServiceProxy) => {
        // this really shouldn't happen since we were able to get the old token
        // the only way this should happen is if the app is put to sleep for a long time
        proxy.logging_service.log({
            severity: Severity.Error,
            message: `Failed to refresh token, logging out`
        });
        remove_account_from_local_storage();
        proxy.set_state(new Unauthorized());
    }
}

export type AuthorizationServiceState = Unauthorized | RefreshingForNewSession | Authorized | RefreshingToContinueSession;

interface NewAuthorizationServiceInput {
    logging_service: LoggingService;
    authorization_client: AuthorizationClient;
}

class AuthorizationService extends Service<AuthorizationServiceState> {
    protected readonly name = 'AuthorizationService';
    public readonly authorization_client: AuthorizationClient;
    private proxy: ServiceProxy;

    private static get_initial_state(): AuthorizationServiceState {
        const account = load_account_from_local_storage();
        if (account === null) {
            return new Unauthorized();
        }
        return new RefreshingForNewSession();
    }

    constructor(input: NewAuthorizationServiceInput) {
        const initial_state = AuthorizationService.get_initial_state();
        super({
            logging_service: input.logging_service,
            initial_state,
        })
        this.authorization_client = input.authorization_client;
        if (initial_state instanceof RefreshingForNewSession) {
            input.authorization_client.refresh_token_with_retry(InitialRetryDelay).then(
                this.handle_refresh_token_success,
                this.handle_refresh_token_failure
            );
        }
        this.proxy = {
            logging_service: this.logging_service,
            authorization_client: input.authorization_client,
            set_state: this.set_state,
            refresh_token: this.refresh_token,
            handle_refresh_token_success: this.handle_refresh_token_success,
            handle_refresh_token_failure: this.handle_refresh_token_failure,
        }
        setInterval(this.refresh_token_if_needed, 60 * 1000);
        window.addEventListener('focus', this.refresh_token_if_needed);
        window.addEventListener('online', this.refresh_token_if_needed);
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.refresh_token_if_needed();
            }
        });
    }

    protected to_string = (state: AuthorizationServiceState): string => {
        return state.name;
    }

    get access_token_available(): boolean {
        return this.get_state().access_token_available;
    }

    get login_required(): boolean {
        return this.get_state().login_required;
    }

    public get_access_token = (): string => {
        return this.get_state().get_access_token();
    }

    public apply_token_output = (token_output: TokenOutput): void => {
        return this.get_state().apply_token_output(this.proxy, token_output);
    }

    private refresh_token = async (): Promise<void> => {
        await this.get_state().refresh_token(this.proxy);
    }

    private handle_refresh_token_success = (token_output: TokenOutput): void => {
        this.get_state().handle_refresh_token_success(this.proxy, token_output);
    }

    private handle_refresh_token_failure = (): void => {
        this.get_state().handle_refresh_token_failure(this.proxy);
    }

    private refresh_token_if_needed = (): void => {
        this.get_state().refresh_token_if_needed(this.proxy);
    }
}

export default AuthorizationService;

const get_access_token_expiry = (expires_in: number): moment.Moment => {
    return moment().add(expires_in, 'seconds').add(-GracePeriod);
}