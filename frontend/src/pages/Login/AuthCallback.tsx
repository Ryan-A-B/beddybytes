import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthorizationService } from '../../services';
import { completeAuth } from '../../services/AuthorizationService/AuthCodeFlow';
import { save_account_to_local_storage } from '../../services/AuthorizationService/AuthorizationClient';
import { AuthorizationError } from '../../services/AuthorizationService/AuthCodeFlow';

const AuthCallback: React.FC = () => {
    const authorization = useAuthorizationService();
    const navigate = useNavigate();
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
            if (failure instanceof AuthorizationError) {
                setError('Your sign-in attempt could not be verified. Please start again.');
                return;
            }
            setError('An unexpected error occurred. Please try again.');
        });
        return () => { mounted = false; };
    }, [authorization, navigate]);
    return <div className="container my-4" aria-live="polite">
        {error ? <>
            <div className="alert alert-danger" role="alert">{error}</div>
            <Link to="/#login" className="btn btn-primary me-2">Sign in</Link>
            <Link to="/#create_account" className="btn btn-outline-light">Create account</Link>
        </> : <p>Completing authentication…</p>}
    </div>;
};

export default AuthCallback;
