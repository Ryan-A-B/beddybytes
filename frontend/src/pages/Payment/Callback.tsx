import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const failureMessages: Record<string, string> = {
    payment_cancelled: 'Checkout was cancelled. You can try again from your account.',
    payment_failed: 'Your payment was not successful. You can try again from your account.',
    payment_pending: 'Your payment is still processing. Check your account before starting another payment.',
    temporarily_unavailable: 'We could not confirm your payment. Check your account before trying again.',
    invalid_request: 'We could not verify this payment return. Please go to your account.',
};

const PaymentCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const failed = searchParams.has('error');
    const error = searchParams.get('error') ?? '';
    return (
        <main className="container wrapper-content pt-3">
            <h1 className="mb-4">Payment {failed ? 'Failed' : 'Successful'}</h1>
            <div className="row">
                <div className="col-12 col-lg-6">
                    {failed
                        ? <p>{failureMessages[error] ?? 'We could not complete your payment. Please check your account.'}</p>
                        : <><p>Thank you for your purchase.</p><p>Visit your account to view your license.</p></>}
                    <Link to="/account" className="btn btn-primary w-100">Go to account</Link>
                </div>
            </div>
        </main>
    );
};

export default PaymentCallback;
