import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthorizationService } from '../../services';
import { AuthorizationError, AuthorizationResponseError, completeAuth } from '../../services/AuthorizationService/AuthCodeFlow';
import { save_account_to_local_storage } from '../../services/AuthorizationService/AuthorizationClient';
import LoginOrCreateAccountForm from './LoginOrCreateAccountForm';
import { TabCreateAccount, TabLogin } from './tab';

const AuthCallback: React.FC = () => {
    const authorization = useAuthorizationService();
    const navigate = useNavigate();
    const [showSignup, setShowSignup] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    React.useEffect(() => {
        let mounted = true;
        completeAuth().then(result => {
            if (!mounted) return;
            save_account_to_local_storage(result.account);
            authorization.apply_token_output(result.token);
            navigate(result.return_to, { replace: true });
        }).catch(failure => {
            if (!mounted) return;
            if (failure instanceof AuthorizationResponseError) {
                setShowSignup(failure.code === 'account_not_found');
                setError(failure.message);
                return;
            }
            if (failure instanceof AuthorizationError) {
                setError('Your sign-in attempt could not be verified. Please start again.');
                return;
            } else if (failure instanceof Error) {
                setError(failure.message);
                return;
            }
            setError('An unexpected error occurred. Please try again.');
        });
        return () => { mounted = false; };
    }, [authorization, navigate]);
    return <div className="container my-4" aria-live="polite">
        {error ? <div className="row">
            <div className="col-xl-4 col-lg-5 col-md-6 mx-auto">
                <div className={`alert ${showSignup ? 'alert-info' : 'alert-danger'}`} role="alert">{error}</div>
                <LoginOrCreateAccountForm
                    initialTab={showSignup ? TabCreateAccount : TabLogin}
                    onAuthenticated={() => navigate('/', { replace: true })}
                />
            </div>
        </div> : <p>Completing authentication…</p>}
    </div>;
};

export default AuthCallback;
