import React from 'react';

interface MessageProps {
    children: React.ReactNode;
}

const Message: React.FunctionComponent<MessageProps> = ({ children }) => (
    <p className="text-center">
        {children}
    </p>
)

export const RedirectToPaymentProcessor: React.FunctionComponent = () => (
    <Message>
        You will be redirected to a secure payment page hosted by Stripe.
    </Message>
)

export const TrialPeriod: React.FunctionComponent = () => (
    <Message>
        <strong>30-day refund guarantee</strong>, no questions asked.
    </Message>
)

export const OnePurchase: React.FunctionComponent = () => (
    <Message>
        Only one purchase per account is needed to access BeddyBytes across all your devices.
    </Message>
)
