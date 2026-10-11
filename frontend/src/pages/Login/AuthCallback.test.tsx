import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { context as ServicesContext } from '../../services';
import { AuthorizationError, AuthorizationResponseError, completeAuth } from '../../services/AuthorizationService/AuthCodeFlow';
import AuthCallback from './AuthCallback';

jest.mock('../../services/AuthorizationService/AuthCodeFlow', () => ({
    ...jest.requireActual('../../services/AuthorizationService/AuthCodeFlow'),
    completeAuth: jest.fn(),
}));

jest.mock('./CreateAccountForm', () => ({ onAuthenticated }: { onAuthenticated?: () => void }) => <>
    <p>Create account form</p><button onClick={onAuthenticated}>Finish account creation</button>
</>);
jest.mock('./LoginForm', () => ({ onAuthenticated }: { onAuthenticated?: () => void }) => <>
    <p>Login form</p><button onClick={onAuthenticated}>Finish login</button>
</>);

afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

test('publishes resolved account before token readiness and returns to station', async () => {
    const account = { id: 'google-account', user: { id: 'google-user', email: 'same@example.com' } };
    const token = { access_token: 'token', token_type: 'Bearer', expires_in: 3600 };
    (completeAuth as jest.Mock).mockResolvedValue({ account, token, return_to: '/parent' });
    const applyToken = jest.fn(() => {
        expect(JSON.parse(localStorage.getItem('account')!)).toEqual(account);
    });
    render(<React.StrictMode><ServicesContext.Provider value={{ authorization_service: { apply_token_output: applyToken } } as any}>
        <MemoryRouter initialEntries={['/auth/callback']}><Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/parent" element={<p>Parent Station ready</p>} />
        </Routes></MemoryRouter>
    </ServicesContext.Provider></React.StrictMode>);
    await screen.findByText('Parent Station ready');
    expect(applyToken).toHaveBeenCalledTimes(1);
    expect(applyToken).toHaveBeenCalledWith(token);
});

test('missing-account login stays signed out and opens the signup form', async () => {
    (completeAuth as jest.Mock).mockRejectedValue(new AuthorizationResponseError('account_not_found'));
    const applyToken = jest.fn();
    render(<ServicesContext.Provider value={{ authorization_service: { apply_token_output: applyToken } } as any}>
        <MemoryRouter><AuthCallback /></MemoryRouter>
    </ServicesContext.Provider>);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("It looks like you don't have a BeddyBytes account yet."));
    expect(screen.getByText('Create account form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toHaveClass('active');
    expect(screen.queryByRole('link', { name: 'Create account' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(screen.getByText('Login form')).toBeInTheDocument();
    expect(screen.queryByText('Create account form')).not.toBeInTheDocument();
    expect(applyToken).not.toHaveBeenCalled();
    expect(localStorage.getItem('account')).toBeNull();
});

test('validation errors display a generic message without publishing a session', async () => {
    (completeAuth as jest.Mock).mockRejectedValue(new AuthorizationError('callback state does not match expected state'));
    const applyToken = jest.fn();
    render(<ServicesContext.Provider value={{ authorization_service: { apply_token_output: applyToken } } as any}>
        <MemoryRouter><AuthCallback /></MemoryRouter>
    </ServicesContext.Provider>);
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('Your sign-in attempt could not be verified. Please start again.');
    expect(screen.queryByText('callback state does not match expected state')).not.toBeInTheDocument();
    expect(screen.getByText('Login form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In' })).toHaveClass('active');
    expect(applyToken).not.toHaveBeenCalled();
    expect(localStorage.getItem('account')).toBeNull();
});

test.each(['signup', 'login'])('successful %s from the recovery form leaves the callback page', async intent => {
    (completeAuth as jest.Mock).mockRejectedValue(new AuthorizationResponseError('account_not_found'));
    render(<ServicesContext.Provider value={{ authorization_service: {} } as any}>
        <MemoryRouter initialEntries={['/auth/callback']}><Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/" element={<p>Account ready</p>} />
        </Routes></MemoryRouter>
    </ServicesContext.Provider>);
    await screen.findByText('Create account form');
    if (intent === 'login') fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    fireEvent.click(screen.getByRole('button', { name: intent === 'signup' ? 'Finish account creation' : 'Finish login' }));
    await screen.findByText('Account ready');
});

test.each([
    ['account_already_exists', 'This identity is already registered. Sign in instead.'],
    ['access_denied', 'Sign-in was cancelled. You can try again.'],
    ['provider_unavailable', 'This sign-in provider is unavailable. Please try another method.'],
    ['temporarily_unavailable', 'Sign-in is temporarily unavailable. Please try again.'],
    ['unrecognised_error', 'Authentication could not be completed. Please try again.'],
])('%s displays its message and opens login', async (code, message) => {
    (completeAuth as jest.Mock).mockRejectedValue(new AuthorizationResponseError(code));
    const applyToken = jest.fn();
    render(<ServicesContext.Provider value={{ authorization_service: { apply_token_output: applyToken } } as any}>
        <MemoryRouter><AuthCallback /></MemoryRouter>
    </ServicesContext.Provider>);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByText('Login form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In' })).toHaveClass('active');
    expect(applyToken).not.toHaveBeenCalled();
});

test('token exchange failure also opens login without navigating away', async () => {
    (completeAuth as jest.Mock).mockRejectedValue(new Error('Your sign-in attempt has expired or could not be completed. Please start again.'));
    render(<ServicesContext.Provider value={{ authorization_service: {} } as any}>
        <MemoryRouter><AuthCallback /></MemoryRouter>
    </ServicesContext.Provider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Your sign-in attempt has expired');
    expect(screen.getByText('Login form')).toBeInTheDocument();
});
