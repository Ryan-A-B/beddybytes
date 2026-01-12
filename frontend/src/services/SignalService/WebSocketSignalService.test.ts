import ConsoleLoggingService from "../LoggingService/ConsoleLoggingService"
import WebSocketSignalService from "./WebSocketSignalService"
import Service, { EventTypeStateChanged, ServiceState } from "../Service";
import { AuthorizationClient, TokenOutput } from "../AuthorizationService/AuthorizationClient";
import { Account } from "../AuthorizationService/Account";
import AuthorizationService from "../AuthorizationService";

const default_account: Account = {
    id: 'test_id',
    user: {
        id: 'user_id',
        email: 'test@example.com',
        password_salt: 'salt',
        password_hash: 'hash',
    },
};

const default_token_output: TokenOutput = {
    token_type: 'Bearer',
    access_token: 'test_access_token',
    expires_in: 60 * 60,
};

const make_default_authorization_client: () => AuthorizationClient = () => ({
    login: jest.fn((email: string, password: string): Promise<TokenOutput> => {
        return Promise.resolve(default_token_output);
    }),
    refresh_token: jest.fn(() => {
        return Promise.resolve(default_token_output);
    }),
    refresh_token_with_retry: jest.fn(() => {
        return Promise.resolve(default_token_output);
    }),
    create_account: jest.fn((email: string, password: string): Promise<Account> => {
        return Promise.resolve(default_account);
    }),
    get_current_account: jest.fn((access_token: string): Promise<Account> => {
        return Promise.resolve(default_account);
    }),
    request_password_reset: jest.fn(),
    reset_password: jest.fn(),
});

const new_authorization_service = (authorization_client: AuthorizationClient = make_default_authorization_client()) => {
    return new AuthorizationService({
        logging_service: new ConsoleLoggingService(),
        authorization_client: authorization_client,
    });
}

describe('WebSocketSignalService', () => {
    test('initial state', () => {
        const logging_service = new ConsoleLoggingService();
        const authorization_service = new_authorization_service();
        authorization_service.apply_token_output(default_token_output);
        const signal_service = new WebSocketSignalService({
            logging_service,
            authorization_service,
        })
        const state = signal_service.get_state();
        expect(state.name).toBe('not_connected');
    })
    describe('start service', () => {
        test('when not connected', async () => {
            const logging_service = new ConsoleLoggingService();
            const authorization_service = new_authorization_service();
            authorization_service.apply_token_output(default_token_output);
            const signal_service = new WebSocketSignalService({
                logging_service,
                authorization_service,
            })
            signal_service.start();
            let state = signal_service.get_state();
            expect(state.name).toBe('preparing_to_connect');
            state = await wait_for_state_change(signal_service);
            expect(state.name).toBe('connecting');
        });
        test('when preparing to connect', async () => {
            const logging_service = new ConsoleLoggingService();
            const authorization_service = new_authorization_service();
            authorization_service.apply_token_output(default_token_output);
            const signal_service = new WebSocketSignalService({
                logging_service,
                authorization_service,
            })
            signal_service.start();
            let state = signal_service.get_state();
            expect(state.name).toBe('preparing_to_connect');
            signal_service.start();
            state = signal_service.get_state();
            expect(state.name).toBe('preparing_to_connect');
            state = await wait_for_state_change(signal_service);
            expect(state.name).toBe('connecting');
        });
        test('when connecting', async () => {
            const logging_service = new ConsoleLoggingService();
            const authorization_service = new_authorization_service();
            authorization_service.apply_token_output(default_token_output);
            const signal_service = new WebSocketSignalService({
                logging_service,
                authorization_service,
            })
            signal_service.start();
            let state = signal_service.get_state();
            expect(state.name).toBe('preparing_to_connect');
            state = await wait_for_state_change(signal_service);
            expect(state.name).toBe('connecting');
            signal_service.start();
            state = signal_service.get_state();
            expect(state.name).toBe('connecting');
        });
    });
    describe('stop service', () => {
        test('when not connected', async () => {
            const logging_service = new ConsoleLoggingService();
            const authorization_service = new_authorization_service();
            authorization_service.apply_token_output(default_token_output);
            const signal_service = new WebSocketSignalService({
                logging_service,
                authorization_service,
            })
            signal_service.stop();
            let state = signal_service.get_state();
            expect(state.name).toBe('not_connected');
        });
        test('when preparing to connect', async () => {
            const logging_service = new ConsoleLoggingService();
            const authorization_service = new_authorization_service();
            authorization_service.apply_token_output(default_token_output);
            const signal_service = new WebSocketSignalService({
                logging_service,
                authorization_service,
            })
            signal_service.start();
            let state = signal_service.get_state();
            expect(state.name).toBe('preparing_to_connect');
            signal_service.stop();
            state = signal_service.get_state();
            expect(state.name).toBe('not_connected');
        });
        test('when connecting', async () => {
            const logging_service = new ConsoleLoggingService();
            const authorization_service = new_authorization_service();
            authorization_service.apply_token_output(default_token_output);
            const signal_service = new WebSocketSignalService({
                logging_service,
                authorization_service,
            })
            signal_service.start();
            let state = await wait_for_state_change(signal_service);
            expect(state.name).toBe('connecting');
            signal_service.stop();
            state = signal_service.get_state();
            expect(state.name).toBe('not_connected');
        });
    });
})

async function wait_for_state_change<T extends ServiceState>(service: Service<T>): Promise<T> {
    return new Promise((resolve) => {
        service.addEventListener(EventTypeStateChanged, () => {
            resolve(service.get_state());
        });
    });
}