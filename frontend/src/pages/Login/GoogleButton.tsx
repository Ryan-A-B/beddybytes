import React from 'react';
import { googleAvailable, GoogleIntent, startGoogle } from '../../services/AuthorizationService/GoogleCodeFlow';

const GoogleButton: React.FC<{ intent: GoogleIntent }> = ({ intent }) => {
    const [available, setAvailable] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    React.useEffect(() => {
        let mounted = true;
        googleAvailable().then(enabled => { if (mounted) setAvailable(enabled); });
        return () => { mounted = false; };
    }, []);
    if (!available) return null;
    const start = () => {
        setBusy(true);
        setError(null);
        startGoogle(intent).catch(() => {
            setError('Google sign-in could not be started. Please try again.');
            setBusy(false);
        });
    };
    return <div className="mb-3">
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <button type="button" id={`google-${intent}`} className="btn btn-outline-light w-100" disabled={busy} onClick={start}>
            {intent === 'signup' ? 'Create account with Google' : 'Sign in with Google'}
        </button>
        <div className="text-center text-body-secondary mt-3">or use email and password</div>
    </div>;
};

export default GoogleButton;
