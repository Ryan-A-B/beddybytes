import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrialExpiredBanner from '.';
import { useAuthorizationService } from '../../services';
import Service from '../../services/Service';
import AuthorizationService from '../../services/AuthorizationService';

jest.mock('../../services', () => ({ useAuthorizationService: jest.fn() }));

class AuthorizationStub extends Service<any> {
    protected name = 'AuthorizationStub';
    protected to_string = () => this.name;
    public update = (access_token_available: boolean, monitor: boolean) => {
        this.set_state({ access_token_available, has_scope: () => monitor });
    };
}

test('reacts to scope loss and restoration without hiding account access', () => {
    const authorization = new AuthorizationStub({
        initial_state: { access_token_available: false, has_scope: () => false },
        logging_service: { log: jest.fn() } as any,
    });
    (useAuthorizationService as jest.Mock).mockReturnValue(authorization);
    render(<MemoryRouter><TrialExpiredBanner /></MemoryRouter>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => authorization.update(true, true));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => authorization.update(true, false));
    expect(screen.getByRole('alert')).toHaveTextContent('Your trial has expired. New monitoring connections are no longer possible.');
    expect(screen.getByRole('link', { name: 'Buy lifetime access' })).toHaveAttribute('href', '/account');
    act(() => authorization.update(true, true));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => authorization.update(true, false));
    act(() => authorization.update(false, false));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([
    [undefined, false],
    ['', false],
    ['account monitor', false],
    ['account', true],
])('uses the backend scp claim to control the banner (%s)', (scope, expired) => {
    localStorage.removeItem('account');
    const authorization = new AuthorizationService({
        authorization_client: {} as any,
        logging_service: { log: jest.fn() } as any,
    });
    authorization.apply_token_output({
        token_type: 'Bearer', expires_in: 3600,
        access_token: `header.${btoa(JSON.stringify({ scp: scope }))}.signature`,
    });
    (useAuthorizationService as jest.Mock).mockReturnValue(authorization);
    render(<MemoryRouter><TrialExpiredBanner /></MemoryRouter>);
    expect(screen.queryByRole('alert') !== null).toBe(expired);
});
