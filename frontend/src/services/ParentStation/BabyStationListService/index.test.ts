import settings from '../../../settings';
import Service, { EventTypeStateChanged, ServiceState } from '../../Service';
import ConsoleLoggingService from '../../LoggingService/ConsoleLoggingService';
import BabyStationListService from './index';
import { Account } from '../../AuthorizationService/Account';
import { AuthorizationClient, TokenOutput } from '../../AuthorizationService/AuthorizationClient';
import AuthorizationService from '../../AuthorizationService';

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
        const authorization_service = new_authorization_service();
        authorization_service.apply_token_output(default_token_output);
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
        const authorization_service = new_authorization_service();
        authorization_service.apply_token_output(default_token_output);
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
        const authorization_service = new_authorization_service();
        authorization_service.apply_token_output(default_token_output);
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
        const authorization_service = new_authorization_service();
        authorization_service.apply_token_output(default_token_output);
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