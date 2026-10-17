import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentCallback from './Callback';

test('shows a single success heading and an account link without requiring login', () => {
    render(<MemoryRouter initialEntries={['/payments/callback']}><PaymentCallback /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Payment Successful' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByText('Thank you for your purchase.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to account' })).toHaveAttribute('href', '/account');
});

test.each([
    ['payment_failed', 'Your payment was not successful.'],
    ['payment_cancelled', 'Checkout was cancelled.'],
    ['payment_pending', 'Your payment is still processing.'],
    ['temporarily_unavailable', 'We could not confirm your payment.'],
    ['invalid_request', 'We could not verify this payment return.'],
    ['unknown', 'We could not complete your payment.'],
    ['', 'We could not complete your payment.'],
])('shows a single failure heading for error=%s', (error, message) => {
    render(<MemoryRouter initialEntries={[`/payments/callback?error=${error}`]}><PaymentCallback /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Payment Failed' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByText(message, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('Thank you for your purchase.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to account' })).toHaveAttribute('href', '/account');
});
