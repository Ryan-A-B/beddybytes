import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthorizationService } from '../../services';
import useServiceState from '../../hooks/useServiceState';

const TrialExpiredBanner: React.FunctionComponent = () => {
    const authorization_service = useAuthorizationService();
    useServiceState(authorization_service);
    const claims = authorization_service.get_claims();
    if (!claims.has_scope('account') || claims.has_scope('monitor')) return null;
    return (
        <div id="trial-expired-banner" className="alert alert-warning mb-0 px-0 border-0 rounded-0" role="alert">
            <div className="container">
                Your trial has expired. New monitoring connections are no longer possible.{' '}
                <Link to="/account">Buy lifetime access</Link> to continue monitoring.
            </div>
        </div>
    );
};

export default TrialExpiredBanner;
