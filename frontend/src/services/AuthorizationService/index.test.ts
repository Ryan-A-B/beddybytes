import Service, { EventTypeStateChanged, ServiceState, wait_for_state_change } from "../Service";
import LoggingService from "../LoggingService/ConsoleLoggingService";
import { AuthorizationClient, TokenOutput } from "./AuthorizationClient";
import AuthorizationService from "."
import get_access_token_asap from "./get_access_token_asap";
import { Account } from "./Account";

const default_account: Account = {
    id: 'test_id',
    license: { type: 'trial', start_unix_seconds: 1700000000, trial_detail: { end_unix_seconds: 1700604800 } },
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
        logging_service: new LoggingService(),
        authorization_client: authorization_client,
    });
}

describe('AuthorizationService', () => {
    describe('initial_state', () => {
        beforeEach(() => {
            localStorage.removeItem('account');
        });
        test('no account in local storage', () => {
            const authorization_service = new_authorization_service();
            expect(authorization_service.get_state().name).toBe('Unauthorized');
        });
        test('account in local storage', () => {
            localStorage.setItem('account', JSON.stringify(default_account));
            const authorization_service = new_authorization_service();
            expect(authorization_service.get_state().name).toBe('RefreshingForNewSession');
        });
    });
    describe('when unauthorized', () => {
        beforeEach(() => {
            localStorage.removeItem('account');
        });
        test('get_access_token throws error', async () => {
            const authorization_service = new_authorization_service();
            expect(() => {
                authorization_service.get_access_token();
            }).toThrowError('can not get access token in Unauthorized state');
        });
        test('apply_token_output', async () => {
            const authorization_client = make_default_authorization_client();
            const authorization_service = new_authorization_service(authorization_client);
            authorization_service.apply_token_output(default_token_output);
            expect(authorization_service.get_state().name).toBe('Authorized');
        });
    });
    describe('when authorized', () => {
        beforeEach(() => {
            localStorage.removeItem('account');
        });
        test('get_access_token returns access token', async () => {
            const authorization_client = make_default_authorization_client();
            const authorization_service = new_authorization_service(authorization_client);
            authorization_service.apply_token_output(default_token_output);
            expect(authorization_service.get_state().name).toBe('Authorized');

            const access_token = await authorization_service.get_access_token();
            expect(access_token).toBe('test_access_token');
        });
        test('apply_token_output quietly ignores', async () => {
            const authorization_client = make_default_authorization_client();
            const authorization_service = new_authorization_service(authorization_client);
            authorization_service.apply_token_output(default_token_output);
            expect(authorization_service.get_state().name).toBe('Authorized');

            authorization_service.apply_token_output(default_token_output);
        });
    });
    describe('after applying token output', () => {
        test('wait for token refresh', async () => {
            jest.useFakeTimers();
            const authorization_client = make_default_authorization_client();
            const authorization_service = new_authorization_service(authorization_client);
            authorization_service.apply_token_output(default_token_output);
            expect(authorization_service.get_state().name).toBe('Authorized');

            jest.advanceTimersByTime(default_token_output.expires_in * 1000);
            expect(authorization_service.get_state().name).toBe('RefreshingToContinueSession');
            await wait_for_state_change(authorization_service);
            expect(authorization_service.get_state().name).toBe('Authorized');
        });
    });
    describe('after RefreshingForNewSession', () => {
        test('wait for token refresh', async () => {
            jest.useFakeTimers();
            localStorage.setItem('account', JSON.stringify(default_account));
            const authorization_client = make_default_authorization_client();
            const authorization_service = new_authorization_service(authorization_client);
            expect(authorization_service.get_state().name).toBe('RefreshingForNewSession');

            expect(authorization_client.refresh_token_with_retry).toHaveBeenCalledTimes(1);

            await wait_for_state_change(authorization_service);
            expect(authorization_service.get_state().name).toBe('Authorized');

            jest.advanceTimersByTime(default_token_output.expires_in * 1000);
            expect(authorization_service.get_state().name).toBe('RefreshingToContinueSession');
            await wait_for_state_change(authorization_service);
            expect(authorization_service.get_state().name).toBe('Authorized');
        });
    });
    describe('after RefreshingToContinueSession', () => {
        beforeEach(() => {
            localStorage.removeItem('account');
        });
        test('wait for token refresh', async () => {
            jest.useFakeTimers();
            const authorization_client = make_default_authorization_client();
            const authorization_service = new_authorization_service(authorization_client);
            authorization_service.apply_token_output(default_token_output);
            expect(authorization_service.get_state().name).toBe('Authorized');

            jest.advanceTimersByTime(default_token_output.expires_in * 1000);
            expect(authorization_service.get_state().name).toBe('RefreshingToContinueSession');
            await wait_for_state_change(authorization_service);
            expect(authorization_service.get_state().name).toBe('Authorized');
            jest.advanceTimersByTime(default_token_output.expires_in * 1000);
            expect(authorization_service.get_state().name).toBe('RefreshingToContinueSession');
            await wait_for_state_change(authorization_service);
            expect(authorization_service.get_state().name).toBe('Authorized');
        });
    });
    describe('get_access_token_asap', () => {
        beforeEach(() => {
            localStorage.removeItem('account');
        });
        test('returns access token after login', async () => {
            const authorization_service = new_authorization_service();
            const get_access_token_promise = get_access_token_asap(authorization_service);
            authorization_service.apply_token_output(default_token_output);
            const access_token = await get_access_token_promise;
            expect(access_token).toBe('test_access_token');
        });
        test('returns access token after refresh A', async () => {
            localStorage.setItem('account', JSON.stringify(default_account));
            const authorization_service = new_authorization_service();
            const get_access_token_promise = get_access_token_asap(authorization_service);
            const access_token = await get_access_token_promise;
            expect(access_token).toBe('test_access_token');
        });
    });
});

describe('token scopes', () => {
    beforeEach(() => localStorage.removeItem('account'));

    test.each([
        ['account monitor', true],
        ['monitor account', true],
        ['account  monitor', true],
        ['account', false],
        ['monitoring monitor:read', false],
        [undefined, false],
        ['', false],
        ['  ', false],
        [['monitor'], false],
        [null, false],
    ])('checks exact scope membership for %s', (scope, expected) => {
        const service = new_authorization_service();
        service.apply_token_output({
            ...default_token_output,
            access_token: `header.${btoa(JSON.stringify({ scp: scope }))}.signature`,
        });
        expect(service.get_claims().has_scope('monitor')).toBe(expected);
        expect(service.get_state().get_claims().has_scope('monitor')).toBe(expected);
    });

    test.each(['malformed', 'header.!.signature', 'header.bnVsbA.signature'])(
        'fails closed for malformed token %s', (access_token) => {
            const service = new_authorization_service();
            service.apply_token_output({ ...default_token_output, access_token });
            expect(service.get_claims().has_scope('monitor')).toBe(false);
        },
    );

    test('prepares claims once and retains them until refreshed tokens arrive', async () => {
        jest.useFakeTimers();
        const client = make_default_authorization_client();
        let complete_refresh!: (output: TokenOutput) => void;
        (client.refresh_token_with_retry as jest.Mock).mockImplementation(() => new Promise<TokenOutput>(resolve => {
            complete_refresh = resolve;
        }));
        const authorization = new_authorization_service(client);
        const decode = jest.spyOn(window, 'atob');
        try {
            authorization.apply_token_output({
                ...default_token_output,
                access_token: `header.${btoa(JSON.stringify({ scp: 'account monitor' }))}.signature`,
            });
            expect(decode).toHaveBeenCalledTimes(1);
            decode.mockClear();
            const claims = authorization.get_claims();
            expect(authorization.get_state().get_claims()).toBe(claims);
            expect(claims.has_scope('monitor')).toBe(true);
            expect(claims.has_scope('account')).toBe(true);
            jest.advanceTimersByTime(default_token_output.expires_in * 1000);
            expect(authorization.get_state().name).toBe('RefreshingToContinueSession');
            expect(authorization.get_claims()).toBe(claims);
            expect(decode).not.toHaveBeenCalled();
            complete_refresh({
                ...default_token_output,
                access_token: `header.${btoa(JSON.stringify({ scp: 'account' }))}.signature`,
            });
            await wait_for_state_change(authorization);
            expect(decode).toHaveBeenCalledTimes(1);
            expect(authorization.get_claims()).not.toBe(claims);
            expect(authorization.get_claims().has_scope('monitor')).toBe(false);
        } finally {
            decode.mockRestore();
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });

    test('has no claims during initial refresh or after refresh failure', async () => {
        localStorage.setItem('account', JSON.stringify(default_account));
        const client = make_default_authorization_client();
        let fail_refresh!: (error: Error) => void;
        (client.refresh_token_with_retry as jest.Mock).mockImplementation(() => new Promise<TokenOutput>((resolve, reject) => {
            fail_refresh = reject;
        }));
        const authorization = new_authorization_service(client);
        expect(authorization.get_state().name).toBe('RefreshingForNewSession');
        expect(authorization.get_claims().has_scope('monitor')).toBe(false);
        fail_refresh(new Error('session expired'));
        await wait_for_state_change(authorization);
        expect(authorization.get_state().name).toBe('Unauthorized');
        expect(authorization.get_claims().has_scope('monitor')).toBe(false);
    });

    test('drops overlapping refresh requests while retaining token and claims', async () => {
        const client = make_default_authorization_client();
        let complete_refresh!: (output: TokenOutput) => void;
        (client.refresh_token_with_retry as jest.Mock).mockImplementation(() => new Promise<TokenOutput>(resolve => {
            complete_refresh = resolve;
        }));
        const authorization = new_authorization_service(client);
        authorization.apply_token_output(default_token_output);
        const claims = authorization.get_claims();
        const refresh = authorization.refresh_token();
        expect(authorization.access_token_available).toBe(true);
        expect(authorization.get_claims()).toBe(claims);
        expect(await authorization.refresh_token()).toBe(false);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
        complete_refresh(default_token_output);
        expect(await refresh).toBe(true);
    });

    test('has no scopes while unauthorized', () => {
        expect(new_authorization_service().get_claims().has_scope('monitor')).toBe(false);
    });
});
