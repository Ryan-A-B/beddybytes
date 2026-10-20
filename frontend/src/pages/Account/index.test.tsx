import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuthorizationService } from '../../services';
import get_access_token_asap from '../../services/AuthorizationService/get_access_token_asap';
import { Account as AccountDetails, License } from '../../services/AuthorizationService/Account';
import settings from '../../settings';
import Account from '.';

jest.mock('../../services', () => ({ useAuthorizationService: jest.fn() }));
jest.mock('../../services/AuthorizationService/get_access_token_asap');

const trial: AccountDetails = {
    id: 'account-1',
    // Deliberately not seven days apart: the UI must display the server's end.
    license: { type: 'trial', start_unix_seconds: 1700000000, trial_detail: { end_unix_seconds: 1701000000 } },
};
const getCurrentAccount = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    (useAuthorizationService as jest.Mock).mockReturnValue({ authorization_client: { get_current_account: getCurrentAccount } });
    (get_access_token_asap as jest.Mock).mockResolvedValue('current-access-token');
    getCurrentAccount.mockResolvedValue(trial);
});

test('shows trial start and backend end, including checkout for an expired trial', async () => {
    const { container } = render(<Account />);
    await screen.findByRole('heading', { name: 'Trial' });
    const times = container.querySelectorAll('time');
    expect(times).toHaveLength(2);
    expect(times[0]).toHaveAttribute('datetime', new Date(trial.license.start_unix_seconds * 1000).toISOString());
    expect(times[1]).toHaveAttribute('datetime', new Date(1701000000 * 1000).toISOString());
    expect(screen.getByRole('button', { name: 'Buy lifetime access' })).toBeEnabled();
    expect(getCurrentAccount).toHaveBeenCalledWith('current-access-token');
});

test.each<[License, string]>([
    [{ type: 'perpetual', start_unix_seconds: 1700000000 }, 'Perpetual'],
    [{ type: 'provisional', start_unix_seconds: 1700000000, provisional_detail: { trial_start_unix_seconds: 1699000000 } }, 'Provisional'],
])('shows %s start without an end or checkout button', async (license, label) => {
    getCurrentAccount.mockResolvedValue({ id: 'account-1', license });
    const { container } = render(<Account />);
    await screen.findByRole('heading', { name: label });
    expect(container.querySelectorAll('time')).toHaveLength(1);
    expect(screen.queryByText('Ends')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buy lifetime access' })).not.toBeInTheDocument();
    if (license.type === 'provisional') expect(screen.getByText('Your payment is processing.')).toBeInTheDocument();
});

test('refreshes on request and does not refresh on focus', async () => {
    getCurrentAccount.mockResolvedValueOnce(trial).mockResolvedValueOnce({ id: 'account-1', license: { type: 'perpetual', start_unix_seconds: 1702000000 } });
    render(<Account />);
    await screen.findByRole('heading', { name: 'Trial' });
    fireEvent(window, new Event('focus'));
    expect(getCurrentAccount).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByRole('heading', { name: 'Perpetual' });
    expect(getCurrentAccount).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Buy lifetime access' })).not.toBeInTheDocument();
});

test('shows load errors and allows a manual retry', async () => {
    getCurrentAccount.mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce(trial);
    render(<Account />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your account.');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByRole('heading', { name: 'Trial' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('submits checkout with the current token in the same tab', async () => {
    const submit = jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    try {
        const { container } = render(<Account />);
        const button = await screen.findByRole('button', { name: 'Buy lifetime access' });
        (get_access_token_asap as jest.Mock).mockResolvedValueOnce('checkout-token');
        fireEvent.click(button);
        await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
        const form = container.querySelector('form')!;
        expect(form).toHaveAttribute('method', 'post');
        expect(form).not.toHaveAttribute('target');
        expect(form).toHaveAttribute('action', `https://${settings.API.host}/payments/start`);
        expect(form.querySelector('input[name="access_token"]')).toHaveValue('checkout-token');
        expect(await screen.findByRole('button', { name: 'Buy lifetime access' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
    } finally {
        submit.mockRestore();
    }
});
