import moment from "moment";
import ConsoleLoggingService from "../LoggingService/ConsoleLoggingService"
import MockAuthorizationService from "../AuthorizationService/MockAuthorizationService"
import WebSocketSignalService from "./WebSocketSignalService"
import Service, { EventTypeStateChanged, ServiceState } from "../Service";

describe('WebSocketSignalService', () => {
    test('initial state', () => {
        const logging_service = new ConsoleLoggingService();
        const authorization_service = new MockAuthorizationService({
            logging_service,
            initial_state: {
                state: 'token_fetched',
                account: {
                    id: 'test_account_id',
                    user: {
                        'id': 'test_user_id',
                        'email': 'test@example.com',
                        'password_hash': 'test_password_hash',
                        'password_salt': 'test_password_salt',
                    }
                },
                access_token: 'mock_access_token',
                expiry: moment().add(1, 'hour'),
            }
        });
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
            const authorization_service = new MockAuthorizationService({
                logging_service,
                initial_state: {
                    state: 'token_fetched',
                    account: {
                        id: 'test_account_id',
                        user: {
                            'id': 'test_user_id',
                            'email': 'test@example.com',
                            'password_hash': 'test_password_hash',
                            'password_salt': 'test_password_salt',
                        }
                    },
                    access_token: 'mock_access_token',
                    expiry: moment().add(1, 'hour'),
                }
            });
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
            const authorization_service = new MockAuthorizationService({
                logging_service,
                initial_state: {
                    state: 'token_fetched',
                    account: {
                        id: 'test_account_id',
                        user: {
                            'id': 'test_user_id',
                            'email': 'test@example.com',
                            'password_hash': 'test_password_hash',
                            'password_salt': 'test_password_salt',
                        }
                    },
                    access_token: 'mock_access_token',
                    expiry: moment().add(1, 'hour'),
                }
            });
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
            const authorization_service = new MockAuthorizationService({
                logging_service,
                initial_state: {
                    state: 'token_fetched',
                    account: {
                        id: 'test_account_id',
                        user: {
                            'id': 'test_user_id',
                            'email': 'test@example.com',
                            'password_hash': 'test_password_hash',
                            'password_salt': 'test_password_salt',
                        }
                    },
                    access_token: 'mock_access_token',
                    expiry: moment().add(1, 'hour'),
                }
            });
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
            const authorization_service = new MockAuthorizationService({
                logging_service,
                initial_state: {
                    state: 'token_fetched',
                    account: {
                        id: 'test_account_id',
                        user: {
                            'id': 'test_user_id',
                            'email': 'test@example.com',
                            'password_hash': 'test_password_hash',
                            'password_salt': 'test_password_salt',
                        }
                    },
                    access_token: 'mock_access_token',
                    expiry: moment().add(1, 'hour'),
                }
            });
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
            const authorization_service = new MockAuthorizationService({
                logging_service,
                initial_state: {
                    state: 'token_fetched',
                    account: {
                        id: 'test_account_id',
                        user: {
                            'id': 'test_user_id',
                            'email': 'test@example.com',
                            'password_hash': 'test_password_hash',
                            'password_salt': 'test_password_salt',
                        }
                    },
                    access_token: 'mock_access_token',
                    expiry: moment().add(1, 'hour'),
                }
            });
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
            const authorization_service = new MockAuthorizationService({
                logging_service,
                initial_state: {
                    state: 'token_fetched',
                    account: {
                        id: 'test_account_id',
                        user: {
                            'id': 'test_user_id',
                            'email': 'test@example.com',
                            'password_hash': 'test_password_hash',
                            'password_salt': 'test_password_salt',
                        }
                    },
                    access_token: 'mock_access_token',
                    expiry: moment().add(1, 'hour'),
                }
            });
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