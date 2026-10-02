import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { context as ServicesContext } from '../../services';
import { completeGoogle } from '../../services/AuthorizationService/GoogleCodeFlow';
import GoogleCompletion from './GoogleCompletion';

jest.mock('../../services/AuthorizationService/GoogleCodeFlow', () => ({ completeGoogle: jest.fn() }));

afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

test('publishes resolved account before token readiness and returns to station', async () => {
    const account = { id: 'google-account', user: { id: 'google-user', email: 'same@example.com' } };
    const token = { access_token: 'token', token_type: 'Bearer', expires_in: 3600 };
    (completeGoogle as jest.Mock).mockResolvedValue({ account, token, return_to: '/parent' });
    const applyToken = jest.fn(() => {
        expect(JSON.parse(localStorage.getItem('account')!)).toEqual(account);
    });
    render(<React.StrictMode><ServicesContext.Provider value={{ authorization_service: { apply_token_output: applyToken } } as any}>
        <MemoryRouter initialEntries={['/auth/google/complete']}><Routes>
            <Route path="/auth/google/complete" element={<GoogleCompletion />} />
            <Route path="/parent" element={<p>Parent Station ready</p>} />
        </Routes></MemoryRouter>
    </ServicesContext.Provider></React.StrictMode>);
    await screen.findByText('Parent Station ready');
    expect(applyToken).toHaveBeenCalledTimes(1);
    expect(applyToken).toHaveBeenCalledWith(token);
});

test('missing-account login stays signed out and offers explicit signup', async () => {
    (completeGoogle as jest.Mock).mockRejectedValue(new Error('No account found.'));
    const applyToken = jest.fn();
    render(<ServicesContext.Provider value={{ authorization_service: { apply_token_output: applyToken } } as any}>
        <MemoryRouter><GoogleCompletion /></MemoryRouter>
    </ServicesContext.Provider>);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No account found.'));
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/#create_account');
    expect(applyToken).not.toHaveBeenCalled();
    expect(localStorage.getItem('account')).toBeNull();
});
