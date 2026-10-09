import React from 'react';
import { AuthIntent, startAuth } from '../../services/AuthorizationService/AuthCodeFlow';
import googleSigninDark from './GoogleSigninDark.svg';
import './GoogleButton.css';

const GoogleButton: React.FC<{ intent: AuthIntent }> = ({ intent }) => {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const start = () => {
        setBusy(true);
        setError(null);
        startAuth('google', intent).catch(() => {
            setError('Google sign-in could not be started. Please try again.');
            setBusy(false);
        });
    };
    return <div className="mb-3">
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <button type="button" id={`google-${intent}`} className="google-signin-button" disabled={busy} onClick={start} aria-busy={busy}>
            <img src={googleSigninDark} width="180" height="40" alt="Sign in with Google" />
        </button>
        <div className="text-center text-body-secondary mt-3">or use email and password</div>
    </div>;
};

export default GoogleButton;
