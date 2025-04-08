import moment from 'moment';
import settings from '../../../settings';
import Service, { EventTypeStateChanged, ServiceState } from '../../Service';
import MockAuthorizationService from '../../AuthorizationService/MockAuthorizationService';
import ConsoleLoggingService from '../../LoggingService/ConsoleLoggingService';
import BabyStationListService from './index';

global.fetch = jest.fn().mockName('fetch');

class MockEventSource extends EventTarget {
    public readonly url: string;

    constructor(url: string) {
        super();
        this.url = url;
    }

    public close() {
        // Mock implementation of close
    }
}

// @ts-ignore
global.EventSource = MockEventSource;

describe('BabyStationListService', () => {
    const mockSnapshot = {
        cursor: 0,
        session_by_id: new Map(),
        session_id_by_connection_id: new Map(),
        connection_by_id: new Map(),
    };

    const mockFetchSnapshot = () => {
        // @ts-ignore
        global.fetch.mockImplementationOnce(async (url: string, init?: RequestInit) => {
            if (url !== `https://${settings.API.host}/baby_station_list_snapshot`)
                throw new Error(`unexpected url: ${url}`);
            return new Response(JSON.stringify(mockSnapshot), { status: 200 });
        });
    };

    test('start service', async () => {
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
        const baby_station_list_service = new BabyStationListService({
            logging_service,
            authorization_service,
        });

        mockFetchSnapshot();

        baby_station_list_service.start();
        let state = baby_station_list_service.get_state();
        expect(state.name).toBe('loading_snapshot');

        state = await wait_for_state_change(baby_station_list_service);
        expect(state.name).toBe('projecting');
    });

    test('stop service after snapshot resolved', async () => {
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
        const baby_station_list_service = new BabyStationListService({
            logging_service,
            authorization_service,
        });

        mockFetchSnapshot();

        baby_station_list_service.start();
        let state = baby_station_list_service.get_state();
        expect(state.name).toBe('loading_snapshot');
        state = await wait_for_state_change(baby_station_list_service);
        expect(state.name).toBe('projecting');
        baby_station_list_service.stop();
        state = baby_station_list_service.get_state();
        expect(state.name).toBe('paused');
        baby_station_list_service.start();
        state = baby_station_list_service.get_state();
        expect(state.name).toBe('projecting');
    });

    test('stop service before snapshot fetched', async () => {
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
        const baby_station_list_service = new BabyStationListService({
            logging_service,
            authorization_service,
        });

        mockFetchSnapshot();

        baby_station_list_service.start();
        let state = baby_station_list_service.get_state();
        expect(state.name).toBe('loading_snapshot');
        baby_station_list_service.stop();
        state = baby_station_list_service.get_state();
        expect(state.name).toBe('paused_waiting_for_snapshot');
        state = await wait_for_state_change(baby_station_list_service);
        expect(state.name).toBe('paused');
        baby_station_list_service.start();
        state = baby_station_list_service.get_state();
        expect(state.name).toBe('projecting');
    });

    test('start and stop twice before snapshot resolves', async () => {
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
        const baby_station_list_service = new BabyStationListService({
            logging_service,
            authorization_service,
        });
    
        mockFetchSnapshot();
    
        baby_station_list_service.start();
        let state = baby_station_list_service.get_state();
        expect(state.name).toBe('loading_snapshot');
        baby_station_list_service.stop();
        state = baby_station_list_service.get_state();
        expect(state.name).toBe('paused_waiting_for_snapshot');
        baby_station_list_service.start();
        state = baby_station_list_service.get_state();
        expect(state.name).toBe('loading_snapshot');
        baby_station_list_service.stop();
        state = baby_station_list_service.get_state();
        expect(state.name).toBe('paused_waiting_for_snapshot');
        state = await wait_for_state_change(baby_station_list_service);
        expect(state.name).toBe('paused');
        baby_station_list_service.start();
        state = baby_station_list_service.get_state();
        expect(state.name).toBe('projecting');
    });
});

async function wait_for_state_change<T extends ServiceState>(service: Service<T>): Promise<T> {
    return new Promise((resolve) => {
        service.addEventListener(EventTypeStateChanged, () => {
            resolve(service.get_state());
        });
    });
}