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
        [undefined, true],
        ['', true],
        ['  ', true],
        [['monitor'], false],
        [null, false],
    ])('checks exact scope membership for %s', (scope, expected) => {
        const service = new_authorization_service();
        service.apply_token_output({
            ...default_token_output,
            access_token: `header.${btoa(JSON.stringify({ scp: scope }))}.signature`,
        });
        expect(service.has_scope('monitor')).toBe(expected);
        expect(service.get_state().has_scope('monitor')).toBe(expected);
    });

    test.each(['malformed', 'header.!.signature', 'header.bnVsbA.signature'])(
        'fails closed for malformed token %s', (access_token) => {
            const service = new_authorization_service();
            service.apply_token_output({ ...default_token_output, access_token });
            expect(service.has_scope('monitor')).toBe(false);
        },
    );

    test('has no scopes while unauthorized', () => {
        expect(new_authorization_service().has_scope('monitor')).toBe(false);
    });
});

describe('trial expiry refresh', () => {
    const monitor_token = `header.${btoa(JSON.stringify({ scp: 'account monitor' }))}.signature`;
    const account_token = `header.${btoa(JSON.stringify({ scp: 'account' }))}.signature`;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-22T12:00:00Z'));
        localStorage.removeItem('account');
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        localStorage.removeItem('account');
    });

    const save_trial = (expires_in_seconds: number) => {
        localStorage.setItem('account', JSON.stringify({
            ...default_account,
            license: {
                type: 'trial', start_unix_seconds: Date.now() / 1000,
                trial_detail: { end_unix_seconds: Date.now() / 1000 + expires_in_seconds },
            },
        }));
    };

    test('refreshes at trial expiry and applies the returned scopes without waiting for JWT expiry', async () => {
        const client = make_default_authorization_client();
        (client.refresh_token_with_retry as jest.Mock).mockResolvedValue({ ...default_token_output, access_token: account_token });
        const authorization = new_authorization_service(client);
        save_trial(5);
        authorization.apply_token_output({ ...default_token_output, access_token: monitor_token });
        jest.advanceTimersByTime(4999);
        expect(client.refresh_token_with_retry).not.toHaveBeenCalled();
        expect(authorization.has_scope('monitor')).toBe(true);
        jest.advanceTimersByTime(1);
        await wait_for_state_change(authorization);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
        expect(authorization.has_scope('monitor')).toBe(false);
        expect(authorization.login_required).toBe(false);
        jest.advanceTimersByTime(60 * 1000);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
    });

    test('startup token refresh also schedules the trial deadline', async () => {
        save_trial(5);
        const client = make_default_authorization_client();
        (client.refresh_token_with_retry as jest.Mock)
            .mockResolvedValueOnce({ ...default_token_output, access_token: monitor_token })
            .mockResolvedValueOnce({ ...default_token_output, access_token: account_token });
        const authorization = new_authorization_service(client);
        await wait_for_state_change(authorization);
        jest.advanceTimersByTime(5000);
        await wait_for_state_change(authorization);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(2);
        expect(authorization.has_scope('monitor')).toBe(false);
    });

    test('checks trial expiry on foreground return when the timer was suspended', async () => {
        const client = make_default_authorization_client();
        (client.refresh_token_with_retry as jest.Mock).mockResolvedValue({ ...default_token_output, access_token: account_token });
        const listener_spy = jest.spyOn(window, 'addEventListener');
        const authorization = new_authorization_service(client);
        const on_focus = listener_spy.mock.calls.find(([type]) => type === 'focus')![1] as EventListener;
        listener_spy.mockRestore();
        save_trial(5);
        authorization.apply_token_output({ ...default_token_output, access_token: monitor_token });
        jest.setSystemTime(Date.now() + 5000);
        on_focus(new Event('focus'));
        await wait_for_state_change(authorization);
        expect(authorization.has_scope('monitor')).toBe(false);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
    });

    test('refreshes again if an earlier refresh crosses the trial deadline', async () => {
        const client = make_default_authorization_client();
        let complete_refresh!: (output: TokenOutput) => void;
        (client.refresh_token_with_retry as jest.Mock)
            .mockImplementationOnce(() => new Promise<TokenOutput>(resolve => { complete_refresh = resolve; }))
            .mockResolvedValueOnce({ ...default_token_output, access_token: account_token });
        const listener_spy = jest.spyOn(window, 'addEventListener');
        const authorization = new_authorization_service(client);
        const on_focus = listener_spy.mock.calls.find(([type]) => type === 'focus')![1] as EventListener;
        listener_spy.mockRestore();
        save_trial(5);
        authorization.apply_token_output({ ...default_token_output, access_token: monitor_token, expires_in: 301 });
        jest.advanceTimersByTime(1000);
        on_focus(new Event('focus'));
        jest.advanceTimersByTime(4000);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
        complete_refresh({ ...default_token_output, access_token: monitor_token });
        await wait_for_state_change(authorization);
        jest.advanceTimersByTime(0);
        await wait_for_state_change(authorization);
        expect(authorization.has_scope('monitor')).toBe(false);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(2);
    });

    test('retains monitoring if the refreshed token allows it and avoids a refresh loop with stale cached trial data', async () => {
        const client = make_default_authorization_client();
        (client.refresh_token_with_retry as jest.Mock).mockResolvedValue({ ...default_token_output, access_token: monitor_token });
        const authorization = new_authorization_service(client);
        save_trial(5);
        authorization.apply_token_output({ ...default_token_output, access_token: monitor_token });
        jest.advanceTimersByTime(5000);
        await wait_for_state_change(authorization);
        jest.advanceTimersByTime(60 * 1000);
        expect(authorization.has_scope('monitor')).toBe(true);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
    });
});
