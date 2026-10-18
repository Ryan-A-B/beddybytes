import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { useAuthorizationService } from '../../services';
import { Account as AccountDetails } from '../../services/AuthorizationService/Account';
import get_access_token_asap from '../../services/AuthorizationService/get_access_token_asap';
import settings from '../../settings';

const LicenseTime: React.FC<{ seconds: number }> = ({ seconds }) => {
    const date = new Date(seconds * 1000);
    return <time dateTime={date.toISOString()}>{date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</time>;
};

const Account: React.FC = () => {
    const authorizationService = useAuthorizationService();
    const [account, setAccount] = React.useState<AccountDetails | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [refreshVersion, setRefreshVersion] = React.useState(0);
    const [checkoutPending, setCheckoutPending] = React.useState(false);
    const tokenInput = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        const loadAccount = async () => {
            try {
                const accessToken = await get_access_token_asap(authorizationService);
                const currentAccount = await authorizationService.authorization_client.get_current_account(accessToken);
                if (active) setAccount(currentAccount);
            } catch {
                if (active) setError('Could not load your account. Please try again.');
            } finally {
                if (active) setLoading(false);
            }
        };
        loadAccount();
        return () => { active = false; };
    }, [authorizationService, refreshVersion]);

    const startCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        setCheckoutPending(true);
        setError(null);
        try {
            const accessToken = await get_access_token_asap(authorizationService);
            tokenInput.current!.value = accessToken;
            form.submit();
        } catch {
            setError('Could not start checkout. Please try again.');
        } finally {
            setCheckoutPending(false);
        }
    };

    return (
        <main className="container wrapper-content">
            <h1 className="mb-4">Account</h1>
            <div className="row">
                <section className="col-12 col-lg-6" aria-labelledby="license-heading" aria-busy={loading}>
                    <div className="d-flex align-items-center justify-content-between mb-4">
                        <h2 id="license-heading" className="h4 mb-0">License</h2>
                        <button type="button" className="btn btn-outline-secondary" disabled={loading || checkoutPending} onClick={() => setRefreshVersion(version => version + 1)}>
                            <FontAwesomeIcon icon={faRotateRight} className="me-2" />Refresh
                        </button>
                    </div>
                    {loading && <p role="status">Loading account…</p>}
                    {error && <div role="alert" className="alert alert-danger">{error}</div>}
                    {account && <>
                        <h3 className="h4 mb-3">{account.license.type}</h3>
                        <dl className="row mb-3">
                            <dt className="col-3 fw-normal">Started</dt>
                            <dd className="col-9"><LicenseTime seconds={account.license.start_unix_seconds} /></dd>
                            {account.license.type === 'Trial' && <>
                                <dt className="col-3 fw-normal">Ends</dt>
                                <dd className="col-9"><LicenseTime seconds={account.license.end_unix_seconds} /></dd>
                            </>}
                        </dl>
                        <p className="text-body-secondary small">Times shown in your local time zone.</p>
                        {account.license.type === 'Provisional' && <p>Your payment is processing.</p>}
                        {account.license.type === 'Trial' && <form action={`https://${settings.API.host}/payments/start`} method="post" onSubmit={startCheckout}>
                            <input ref={tokenInput} type="hidden" name="access_token" />
                            <button type="submit" className="btn btn-primary w-100" disabled={checkoutPending || loading}>
                                {checkoutPending ? 'Opening checkout…' : 'Buy lifetime access'}
                            </button>
                        </form>}
                    </>}
                </section>
            </div>
        </main>
    );
};

export default Account;
