import settings from '../../settings';
import { Account } from './Account';
import { TokenOutput } from './AuthorizationClient';

export type GoogleIntent = 'login' | 'signup';
const TransactionKey = 'google-auth-transaction';
const ClientID = 'beddybytes-browser';
export const GoogleCompletionPath = '/auth/google/complete';

interface Transaction {
    state: string;
    verifier: string;
    intent: GoogleIntent;
    redirect_uri: string;
    return_to: string;
    created: number;
}

const base64url = (bytes: Uint8Array): string =>
    btoa(String.fromCharCode(...Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomSecret = (): string => base64url(window.crypto.getRandomValues(new Uint8Array(32)));

let availability: Promise<boolean> | undefined;
export const googleAvailable = (): Promise<boolean> => {
    if (!availability) {
        availability = fetch(`https://${settings.API.host}/auth/google/config`)
            .then(async response => response.ok && (await response.json()).enabled === true)
            .catch(() => false);
    }
    return availability;
};

export const createGoogleStartURL = async (intent: GoogleIntent): Promise<string> => {
    const verifier = randomSecret();
    const challenge = base64url(new Uint8Array(await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const state = randomSecret();
    const redirect_uri = window.location.origin + GoogleCompletionPath;
    const return_to = ['/', '/baby', '/parent'].includes(window.location.pathname) ? window.location.pathname : '/';
    const transaction: Transaction = { state, verifier, intent, redirect_uri, return_to, created: Date.now() };
    sessionStorage.setItem(TransactionKey, JSON.stringify(transaction));
    const url = new URL(`https://${settings.API.host}/auth/google/start`);
    url.search = new URLSearchParams({
        intent, state, client_id: ClientID, redirect_uri,
        code_challenge: challenge, code_challenge_method: 'S256',
    }).toString();
    return url.toString();
};

export const startGoogle = async (intent: GoogleIntent): Promise<void> => {
    window.location.assign(await createGoogleStartURL(intent));
};

// Capture and remove the code during module initialization, before services
// log page URLs or React renders. The promise below survives StrictMode effects.
const callback = (() => {
    if (window.location.pathname !== GoogleCompletionPath) return null;
    const params = new URLSearchParams(window.location.search);
    const result = { code: params.get('code'), state: params.get('state'), error: params.get('error') };
    window.history.replaceState(window.history.state, '', GoogleCompletionPath);
    return result;
})();

const errorMessages: Record<string, string> = {
    account_not_found: 'No BeddyBytes account is registered with this Google account. Create an account to get started.',
    account_already_exists: 'This Google account is already registered. Sign in instead.',
    access_denied: 'Google sign-in was cancelled. You can try again.',
    authentication_failed: 'Google authentication could not be completed. Please try again.',
};

export interface GoogleCompletion {
    token: TokenOutput;
    account: Account;
    return_to: string;
}

let completion: Promise<GoogleCompletion> | undefined;
export const completeGoogle = (): Promise<GoogleCompletion> => {
    if (!completion) completion = exchangeGoogleCode();
    return completion;
};

const exchangeGoogleCode = async (): Promise<GoogleCompletion> => {
    const saved = sessionStorage.getItem(TransactionKey);
    sessionStorage.removeItem(TransactionKey);
    let transaction: Transaction;
    try {
        transaction = JSON.parse(saved || 'null');
    } catch {
        throw new Error('Your sign-in attempt could not be verified. Please start again.');
    }
    if (!callback || !transaction || !callback.state || callback.state !== transaction.state ||
        !Number.isFinite(transaction.created) || Date.now() - transaction.created > 10 * 60 * 1000 || transaction.created > Date.now() ||
        transaction.redirect_uri !== window.location.origin + GoogleCompletionPath || !/^[A-Za-z0-9_-]{43}$/.test(transaction.verifier)) {
        throw new Error('Your sign-in attempt could not be verified. Please start again.');
    }
    if (callback.error) {
        throw new Error(errorMessages[callback.error] || 'Google authentication could not be completed. Please try again.');
    }
    if (!callback.code) throw new Error('Your sign-in attempt could not be completed. Please start again.');
    const response = await fetch(`https://${settings.API.host}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
        body: new URLSearchParams({ grant_type: 'authorization_code', code: callback.code, code_verifier: transaction.verifier, client_id: ClientID, redirect_uri: transaction.redirect_uri }),
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
