import { createHash, webcrypto } from 'crypto';
import { TextEncoder } from 'util';

jest.mock('../../settings', () => ({ __esModule: true, default: { API: { host: 'api.example.com' } } }));

const transactionKey = 'auth-transaction';
const state = 's'.repeat(43);
const verifier = 'v'.repeat(43);
const transaction = () => ({ state, verifier, intent: 'login', redirect_uri: window.location.origin + '/auth/callback', return_to: '/parent', created: Date.now() });

const loadCallback = (query: string) => {
    window.history.replaceState(null, '', '/auth/callback?' + query);
    return require('./AuthCodeFlow') as typeof import('./AuthCodeFlow');
};

beforeEach(() => {
    jest.resetModules();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
    Object.defineProperty(global, 'TextEncoder', { configurable: true, value: TextEncoder });
    global.fetch = jest.fn();
});

test.each(['login', 'signup'] as const)('starts explicit %s with S256 and per-tab verifier', async intent => {
    window.history.replaceState(null, '', '/baby');
    const flow = require('./AuthCodeFlow') as typeof import('./AuthCodeFlow');
    const url = new URL(await flow.createAuthStartURL('google', intent));
    const saved = JSON.parse(sessionStorage.getItem(transactionKey)!);
    expect(url.origin + url.pathname).toBe('https://api.example.com/auth/start');
    expect(url.searchParams.get('intent')).toBe(intent);
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('scope')).toBe('account monitor');
    expect(saved.provider).toBeUndefined();
    expect(url.searchParams.get('state')).toBe(saved.state);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(saved.verifier).digest('base64url'));
    expect(url.searchParams.has('code_verifier')).toBe(false);
    expect(saved.return_to).toBe('/baby');
    expect(fetch).not.toHaveBeenCalled();
});

test('exchanges once, strips URL, and fetches account before completion', async () => {
    sessionStorage.setItem(transactionKey, JSON.stringify(transaction()));
    const flow = loadCallback('code=beddybytes-code&state=' + state);
    expect(window.location.search).toBe('');
    const token = { token_type: 'Bearer', access_token: 'beddybytes-token', expires_in: 3600 };
    const account = { id: 'google-account', user: { id: 'google-user', email: 'same@example.com' } };
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => token }).mockResolvedValueOnce({ ok: true, json: async () => account });
    const first = flow.completeAuth();
    const second = flow.completeAuth();
    expect(first).toBe(second);
    await expect(first).resolves.toEqual({ token, account, return_to: '/parent' });
    expect(fetch).toHaveBeenCalledTimes(2);
    const options = (fetch as jest.Mock).mock.calls[0][1];
    const body = options.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('beddybytes-code');
    expect(body.get('code_verifier')).toBe(verifier);
    expect(body.get('client_id')).toBe('beddybytes-browser');
    expect(body.get('redirect_uri')).toBe(window.location.origin + '/auth/callback');
    expect(body.has('provider')).toBe(false);
    expect(options.credentials).toBe('include');
    expect((fetch as jest.Mock).mock.calls[1][1].headers.Authorization).toBe('Bearer beddybytes-token');
    expect(sessionStorage.getItem(transactionKey)).toBeNull();
});

test.each(['missing_transaction', 'wrong_state', 'expired', 'wrong_redirect', 'malformed_transaction'])('rejects %s before exchanging a code', async mode => {
    const saved = transaction();
    if (mode === 'expired') saved.created -= 11 * 60 * 1000;
    if (mode === 'wrong_redirect') saved.redirect_uri = 'https://evil.example/callback';
    if (mode !== 'missing_transaction') sessionStorage.setItem(transactionKey, mode === 'malformed_transaction' ? '{invalid' : JSON.stringify(saved));
    const flow = loadCallback('code=beddybytes-code&state=' + (mode === 'wrong_state' ? 'attacker' : state));
    await expect(flow.completeAuth()).rejects.toThrow('could not be verified');
    expect(fetch).not.toHaveBeenCalled();
});

test.each(['account_not_found', 'account_already_exists', 'access_denied'])('returns controlled %s outcome without token exchange', async error => {
    sessionStorage.setItem(transactionKey, JSON.stringify(transaction()));
    const flow = loadCallback('error=' + error + '&state=' + state);
    await expect(flow.completeAuth()).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
});

test('does not retry a rejected single-use code or publish an account', async () => {
    sessionStorage.setItem(transactionKey, JSON.stringify(transaction()));
    const flow = loadCallback('code=expired-code&state=' + state);
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    await expect(flow.completeAuth()).rejects.toThrow('expired');
    await expect(flow.completeAuth()).rejects.toThrow('expired');
    expect(fetch).toHaveBeenCalledTimes(1);
});

test('callback does not refresh the cached password account during initialization', () => {
    localStorage.setItem('account', JSON.stringify({ id: 'old-password-account' }));
    window.history.replaceState(null, '', '/auth/callback?code=code&state=' + state);
    const AuthorizationService = require('./index').default;
    const client = { refresh_token_with_retry: jest.fn() };
    const service = new AuthorizationService({ authorization_client: client, logging_service: { log: jest.fn() } });
    expect(service.login_required).toBe(true);
    expect(client.refresh_token_with_retry).not.toHaveBeenCalled();
    localStorage.clear();
});
