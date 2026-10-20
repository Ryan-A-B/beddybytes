import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthorizationService } from '../../services';
import useServiceState from '../../hooks/useServiceState';

const TrialExpiredBanner: React.FunctionComponent = () => {
    const authorization = useServiceState(useAuthorizationService());
    if (!authorization.access_token_available || authorization.has_scope('monitor')) return null;
    return (
        <div className="alert alert-warning m-3" role="alert">
            Your trial has expired. New monitoring connections are no longer possible.{' '}
            <Link to="/account">Buy lifetime access</Link> to continue monitoring.
        </div>
    );
};

export default TrialExpiredBanner;
