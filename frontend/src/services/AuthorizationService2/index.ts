import moment from "moment";
import settings from "../../settings";
import LoggingService, { Severity } from '../LoggingService';
import { AuthorizationClient, TokenOutput } from "./AuthorizationClient";
import Service from "../Service";

const InitialRetryDelay = 1000;

const GracePeriod = moment.duration(5, 'minutes');

interface ServiceProxy {
    logging_service: LoggingService;
    authorization_client: AuthorizationClient;
    set_state(state: AuthorizationServiceState): void;
    handle_create_account_success(account: Account, email: string, password: string): Promise<void>;
    handle_create_account_failure(): void;
    handle_login_success(token_output: TokenOutput): void;
    handle_login_failure(): void;
    refresh_token(): void;
    handle_refresh_token_success(token_output: TokenOutput): void;
    handle_refresh_token_failure(): void;
}

abstract class AbstractState {
    public abstract readonly name: string;

    public create_account_and_login = async (proxy: ServiceProxy, email: string, password: string): Promise<void> => {
        throw new Error(`can not create account and login in ${this.name} state`);
    };

    public login = async (proxy: ServiceProxy, email: string, password: string): Promise<void> => {
        throw new Error(`can not login in ${this.name} state`);
    };

    public get_access_token = (): string => {
        throw new Error(`can not get access token in ${this.name} state`);
    };

    public apply_token_output = (proxy: ServiceProxy, token_output: TokenOutput): void => {
        throw new Error(`will not apply token output in ${this.name} state`);
    }

    public handle_create_account_success = async (proxy: ServiceProxy, account: Account, email: string, password: string): Promise<void> => {
        // ignore
    };

    public handle_create_account_failure = (proxy: ServiceProxy): void => {
        // ignore
    };

    public handle_login_success = (proxy: ServiceProxy, token_output: TokenOutput): void => {
        // ignore
    };

    public handle_login_failure = (proxy: ServiceProxy): void => {
        // ignore
    };

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

    create_account_and_login = async (proxy: ServiceProxy, email: string, password: string): Promise<void> => {
        proxy.set_state(new CreatingAccount());
        try {
            const account = await proxy.authorization_client.create_account(email, password);
            proxy.handle_create_account_success(account, email, password);
        } catch (error) {
            proxy.handle_create_account_failure();
            throw error;
        }
    }

    login = async (proxy: ServiceProxy, email: string, password: string): Promise<void> => {
        proxy.set_state(new LoggingIn());
        try {
            const token_output = await proxy.authorization_client.login(email, password);
            const account = await proxy.authorization_client.get_current_account(token_output.access_token);
            save_account_to_local_storage(account);
            proxy.handle_login_success(token_output);
        } catch (error) {
            proxy.handle_login_failure();
            throw error;
        }
    }

    apply_token_output = (proxy: ServiceProxy, token_output: TokenOutput): void => {
        proxy.set_state(new Authorized(token_output.access_token));
    }
}

class CreatingAccount extends AbstractState {
    public readonly name = 'CreatingAccount';

    handle_create_account_success = async (proxy: ServiceProxy, account: Account, email: string, password: string): Promise<void> => {
        proxy.set_state(new LoggingIn());
        try {
            const token_output = await proxy.authorization_client.login(email, password);
            save_account_to_local_storage(account);
            proxy.handle_login_success(token_output);
        } catch (error) {
            proxy.handle_login_failure();
            throw error;
        }
    }

    handle_create_account_failure = (proxy: ServiceProxy): void => {
        proxy.set_state(new Unauthorized());
    }
}

class LoggingIn extends AbstractState {
    public readonly name = 'LoggingIn';

    handle_login_success = (proxy: ServiceProxy, token_output: TokenOutput): void => {
        proxy.set_state(new Authorized(token_output.access_token));
        const refresh_in = (token_output.expires_in * 1000) - GracePeriod.asMilliseconds();
        setTimeout(proxy.refresh_token, refresh_in);
    }

    handle_login_failure = (proxy: ServiceProxy): void => {
        proxy.set_state(new Unauthorized());
    }
}

class RefreshingA extends AbstractState {
    public readonly name = 'RefreshingA';

    handle_refresh_token_success = (proxy: ServiceProxy, token_output: TokenOutput) => {
        proxy.set_state(new Authorized(token_output.access_token));
        const refresh_in = (token_output.expires_in * 1000) - GracePeriod.asMilliseconds();
        setTimeout(proxy.refresh_token, refresh_in);
    }

    handle_refresh_token_failure = (proxy: ServiceProxy): void => {
        // likely their refresh token has expired
        remove_account_from_local_storage();
        proxy.set_state(new Unauthorized());
    }
}

class Authorized extends AbstractState {
    public readonly name = 'Authorized';

    private readonly access_token: string;

    constructor(access_token: string) {
        super();
        this.access_token = access_token;
    }

    get_access_token = (): string => {
        return this.access_token;
    }

    refresh_token = async (proxy: ServiceProxy): Promise<void> => {
        proxy.set_state(new RefreshingB(this.access_token));
        try {
            const token_output = await proxy.authorization_client.refresh_token_with_retry(InitialRetryDelay);
            proxy.handle_refresh_token_success(token_output);
        } catch (error) {
            proxy.handle_refresh_token_failure();
        }
    }
}

class RefreshingB extends AbstractState {
    public readonly name = 'RefreshingB';

    private readonly access_token: string;

    constructor(access_token: string) {
        super();
        this.access_token = access_token;
    }

    get_access_token = (): string => {
        return this.access_token;
    }

    handle_refresh_token_success = (proxy: ServiceProxy, token_output: TokenOutput) => {
        proxy.set_state(new Authorized(token_output.access_token));
        const refresh_in = (token_output.expires_in * 1000) - GracePeriod.asMilliseconds();
        setTimeout(proxy.refresh_token, refresh_in);
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

export type AuthorizationServiceState = Unauthorized | CreatingAccount | LoggingIn | RefreshingA | Authorized | RefreshingB;

interface NewAuthorizationServiceInput {
    logging_service: LoggingService;
    authorization_client: AuthorizationClient;
}

class AuthorizationService extends Service<AuthorizationServiceState> {
    protected readonly name = 'AuthorizationService';
    private proxy: ServiceProxy;

    private static get_initial_state(authorization_client: AuthorizationClient): AuthorizationServiceState {
        const account = load_account_from_local_storage();
        if (account === null) {
            return new Unauthorized();
        }
        authorization_client.refresh_token_with_retry(InitialRetryDelay);
        return new RefreshingA();
    }

    constructor(input: NewAuthorizationServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: AuthorizationService.get_initial_state(input.authorization_client),
        })
        this.proxy = {
            logging_service: this.logging_service,
            authorization_client: input.authorization_client,
            set_state: this.set_state,
            handle_create_account_success: this.handle_create_account_success,
            handle_create_account_failure: this.handle_create_account_failure,
            handle_login_success: this.handle_login_success,
            handle_login_failure: this.handle_login_failure,
            refresh_token: this.refresh_token,
            handle_refresh_token_success: this.handle_refresh_token_success,
            handle_refresh_token_failure: this.handle_refresh_token_failure,
        }
    }

    protected to_string = (state: AuthorizationServiceState): string => {
        return state.name;
    }

    public create_account_and_login = async (email: string, password: string): Promise<void> => {
        return this.get_state().create_account_and_login(this.proxy, email, password);
    }

    public login = async (email: string, password: string): Promise<void> => {
        return this.get_state().login(this.proxy, email, password);
    }

    public get_access_token = (): string => {
        return this.get_state().get_access_token();
    }

    public apply_token_output = (token_output: TokenOutput): void => {
        return this.get_state().apply_token_output(this.proxy, token_output);
    }

    private handle_create_account_success = async (account: Account, email: string, password: string): Promise<void> => {
        await this.get_state().handle_create_account_success(this.proxy, account, email, password);
    }

    private handle_create_account_failure = (): void => {
        this.get_state().handle_create_account_failure(this.proxy);
    }

    private handle_login_success = (token_output: TokenOutput): void => {
        this.get_state().handle_login_success(this.proxy, token_output);
    }

    private handle_login_failure = (): void => {
        this.get_state().handle_login_failure(this.proxy);
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

