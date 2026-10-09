import settings from '../../settings';
import { Account } from './Account';
import { TokenOutput } from './AuthorizationClient';

export type AuthIntent = 'login' | 'signup';
export type AuthProvider = 'google';
const TransactionKey = 'auth-transaction';
const ClientID = 'beddybytes-browser';
export const AuthCallbackPath = '/auth/callback';

interface Transaction {
    state: string;
    verifier: string;
    intent: AuthIntent;
    redirect_uri: string;
    return_to: string;
    created: number;
}

const base64url = (bytes: Uint8Array): string =>
    btoa(String.fromCharCode(...Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomSecret = (): string => base64url(window.crypto.getRandomValues(new Uint8Array(32)));

export const createAuthStartURL = async (provider: AuthProvider, intent: AuthIntent): Promise<string> => {
    const verifier = randomSecret();
    const challenge = base64url(new Uint8Array(await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const state = randomSecret();
    const redirect_uri = window.location.origin + AuthCallbackPath;
    const return_to = ['/', '/baby', '/parent'].includes(window.location.pathname) ? window.location.pathname : '/';
    const transaction: Transaction = { state, verifier, intent, redirect_uri, return_to, created: Date.now() };
    sessionStorage.setItem(TransactionKey, JSON.stringify(transaction));
    const url = new URL(`https://${settings.API.host}/auth/start`);
    url.search = new URLSearchParams({
        provider, intent, scope: 'account monitor', state, client_id: ClientID, redirect_uri,
        code_challenge: challenge, code_challenge_method: 'S256',
    }).toString();
    return url.toString();
};

export const startAuth = async (provider: AuthProvider, intent: AuthIntent): Promise<void> => {
    window.location.assign(await createAuthStartURL(provider, intent));
};

// Capture and remove the code during module initialization, before services
// log page URLs or React renders. The promise below survives StrictMode effects.
const callbackResult = (() => {
    if (window.location.pathname !== AuthCallbackPath) return null;
    const params = new URLSearchParams(window.location.search);
    const result = {
        code: params.get('code'),
        state: params.get('state'),
        error: params.get('error'),
    };
    window.history.replaceState(window.history.state, '', AuthCallbackPath);
    return result;
})();

const errorMessages: Record<string, string> = {
    account_not_found: "It looks like you don't have a BeddyBytes account yet. Create one below, or switch to Log In to use a different account.",
    account_already_exists: 'This identity is already registered. Sign in instead.',
    access_denied: 'Sign-in was cancelled. You can try again.',
    authentication_failed: 'Authentication could not be completed. Please try again.',
    invalid_request: 'Your sign-in attempt could not be verified. Please start again.',
    invalid_grant: 'Your sign-in attempt has expired or could not be completed. Please start again.',
    unauthorized: 'Sign-in could not be completed. Please try again.',
    unsupported: 'This sign-in method is not supported. Please try another method.',
    provider_unavailable: 'This sign-in provider is unavailable. Please try another method.',
    server_error: 'Sign-in could not be completed. Please try again.',
    temporarily_unavailable: 'Sign-in is temporarily unavailable. Please try again.',
};

export interface AuthCallbackResult {
    token: TokenOutput;
    account: Account;
    return_to: string;
}

let completion: Promise<AuthCallbackResult> | undefined;
export const completeAuth = (): Promise<AuthCallbackResult> => {
    if (!completion) completion = exchangeAuthCode();
    return completion;
};

const exchangeAuthCode = async (): Promise<AuthCallbackResult> => {
    const transactionJSON = sessionStorage.getItem(TransactionKey);
    if (!transactionJSON) throw new Error('Your sign-in attempt could not be verified. Please start again.');
    sessionStorage.removeItem(TransactionKey);
    const transaction: Transaction = JSON.parse(transactionJSON);
    const authorizationCode = getValidatedAuthorizationCode(transaction);
    const response = await fetch(`https://${settings.API.host}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: authorizationCode,
            code_verifier: transaction.verifier,
            client_id: ClientID,
            redirect_uri: transaction.redirect_uri,
        }),
    });
    if (!response.ok) throw new Error('Your sign-in attempt has expired or could not be completed. Please start again.');
    const token: TokenOutput = await response.json();
    const accountResponse = await fetch(`https://${settings.API.host}/accounts/current`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!accountResponse.ok) throw new Error('Your account could not be loaded. Please sign in again.');
    const account: Account = await accountResponse.json();
    return { token, account, return_to: ['/', '/baby', '/parent'].includes(transaction.return_to) ? transaction.return_to : '/' };
};

// Expected outcomes from a verified callback are distinct from validation failures.
export class AuthorizationResponseError extends Error {
    constructor(public readonly code: string) {
        super(errorMessages[code] || 'Authentication could not be completed. Please try again.');
        this.name = 'AuthorizationResponseError';
    }
}

export class AuthorizationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthorizationError';
    }
}

const getValidatedAuthorizationCode = (transaction: Transaction): string => {
    if (!callbackResult) throw new AuthorizationError('no callback result');
    const expectedState = transaction.state;
    if (callbackResult.state !== expectedState) throw new AuthorizationError('callback state does not match expected state');
    if (!Number.isFinite(transaction.created)) throw new AuthorizationError('transaction created timestamp is not finite');
    const now = Date.now();
    if (now < transaction.created) throw new AuthorizationError('transaction created timestamp is in the future');
    const age = now - transaction.created;
    const maxAge = 10 * 60 * 1000;
    if (age > maxAge) throw new AuthorizationError('transaction has expired');
    const expectedRedirectUri = window.location.origin + AuthCallbackPath;
    if (transaction.redirect_uri !== expectedRedirectUri) throw new AuthorizationError('redirect URI does not match expected URI');
    const verifierPattern = /^[A-Za-z0-9_-]{43}$/;
    if (!verifierPattern.test(transaction.verifier)) throw new AuthorizationError('code verifier does not match expected pattern');
    if (callbackResult.error) throw new AuthorizationResponseError(callbackResult.error);
    if (!callbackResult.code) throw new AuthorizationError('callback code is missing');
    return callbackResult.code;
}
