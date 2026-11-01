import AuthorizationService from './AuthorizationService';
import { AuthorizationClient, TokenOutput } from './AuthorizationService/AuthorizationClient';
import { Account } from './AuthorizationService/Account';
import LoggingService from './LoggingService/ConsoleLoggingService';
import { wait_for_state_change } from './Service';
import TrialExpiryService from './TrialExpiryService';

const trial_expiry_services: TrialExpiryService[] = [];

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
    const authorization_service = new AuthorizationService({
        logging_service: new LoggingService(),
        authorization_client: authorization_client,
    });
    const trial_expiry_service = new TrialExpiryService(authorization_service);
    trial_expiry_service.start();
    trial_expiry_services.push(trial_expiry_service);
    return authorization_service;
}

describe('trial expiry refresh', () => {
    const monitor_token = `header.${btoa(JSON.stringify({ scp: 'account monitor' }))}.signature`;
    const account_token = `header.${btoa(JSON.stringify({ scp: 'account' }))}.signature`;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-22T12:00:00Z'));
        localStorage.removeItem('account');
    });

    afterEach(() => {
        trial_expiry_services.splice(0).forEach(service => service.stop());
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
        expect(authorization.get_claims().has_scope('monitor')).toBe(true);
        jest.advanceTimersByTime(1);
        await wait_for_state_change(authorization);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
        expect(authorization.get_claims().has_scope('monitor')).toBe(false);
        expect(authorization.login_required).toBe(false);
        await new Promise(resolve => jest.requireActual('timers').setImmediate(resolve));
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
        expect(authorization.get_claims().has_scope('monitor')).toBe(false);
    });

    test('checks trial expiry on foreground return when the timer was suspended', async () => {
        const client = make_default_authorization_client();
        (client.refresh_token_with_retry as jest.Mock).mockResolvedValue({ ...default_token_output, access_token: account_token });
        const listener_spy = jest.spyOn(window, 'addEventListener');
        const authorization = new_authorization_service(client);
        const on_focus = listener_spy.mock.calls.filter(([type]) => type === 'focus').map(([, listener]) => listener as EventListener);
        listener_spy.mockRestore();
        save_trial(5);
        authorization.apply_token_output({ ...default_token_output, access_token: monitor_token });
        jest.setSystemTime(Date.now() + 5000);
        on_focus.forEach(listener => listener(new Event('focus')));
        await wait_for_state_change(authorization);
        expect(authorization.get_claims().has_scope('monitor')).toBe(false);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
    });

    test('treats trial expiry as handled when a refresh is already running', async () => {
        const client = make_default_authorization_client();
        let complete_refresh!: (output: TokenOutput) => void;
        (client.refresh_token_with_retry as jest.Mock)
            .mockImplementationOnce(() => new Promise<TokenOutput>(resolve => { complete_refresh = resolve; }));
        const listener_spy = jest.spyOn(window, 'addEventListener');
        const authorization = new_authorization_service(client);
        const on_focus = listener_spy.mock.calls.filter(([type]) => type === 'focus').map(([, listener]) => listener as EventListener);
        listener_spy.mockRestore();
        save_trial(5);
        authorization.apply_token_output({ ...default_token_output, access_token: monitor_token, expires_in: 301 });
        jest.advanceTimersByTime(1000);
        on_focus.forEach(listener => listener(new Event('focus')));
        jest.advanceTimersByTime(4000);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
        complete_refresh({ ...default_token_output, access_token: monitor_token });
        await wait_for_state_change(authorization);
        jest.advanceTimersByTime(60 * 1000);
        expect(authorization.get_claims().has_scope('monitor')).toBe(true);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
    });

    test('retains monitoring if the refreshed token allows it and avoids a refresh loop with stale cached trial data', async () => {
        const client = make_default_authorization_client();
        (client.refresh_token_with_retry as jest.Mock).mockResolvedValue({ ...default_token_output, access_token: monitor_token });
        const authorization = new_authorization_service(client);
        save_trial(5);
        authorization.apply_token_output({ ...default_token_output, access_token: monitor_token });
        jest.advanceTimersByTime(5000);
        await wait_for_state_change(authorization);
        await new Promise(resolve => jest.requireActual('timers').setImmediate(resolve));
        jest.advanceTimersByTime(60 * 1000);
        expect(authorization.get_claims().has_scope('monitor')).toBe(true);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
    });

    test('stopping cancels deadline and foreground refreshes', () => {
        const client = make_default_authorization_client();
        const authorization = new_authorization_service(client);
        save_trial(5);
        authorization.apply_token_output({ ...default_token_output, access_token: monitor_token });
        trial_expiry_services[0].stop();
        jest.advanceTimersByTime(5000);
        window.dispatchEvent(new Event('focus'));
        expect(client.refresh_token_with_retry).not.toHaveBeenCalled();
    });

    test('starting after authorization schedules the current trial and is idempotent', async () => {
        const client = make_default_authorization_client();
        const authorization = new_authorization_service(client);
        const service = trial_expiry_services[0];
        service.stop();
        save_trial(5);
        authorization.apply_token_output({ ...default_token_output, access_token: monitor_token });
        service.start();
        service.start();
        jest.advanceTimersByTime(5000);
        await wait_for_state_change(authorization);
        expect(client.refresh_token_with_retry).toHaveBeenCalledTimes(1);
    });

});
