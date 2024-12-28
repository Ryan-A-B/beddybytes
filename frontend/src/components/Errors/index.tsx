import React from 'react';
import ErrorService from '../../services/ErrorService';
import useServiceState from '../../hooks/useServiceState';
import Container from './Container';

import './style.scss';

interface Props {
    error_service: ErrorService
}

const Errors: React.FunctionComponent<Props> = ({ error_service }) => {
    const errors = useServiceState(error_service);

    const add_error = React.useCallback(() => {
        error_service.add_error(new Error("Error playing video element in ParentStation usePlay: The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission. play@[native code]"));
    }, [error_service]);

    const AddErrorButton = () => (
        <button
            type="button"
            className="btn btn-primary"
            onClick={add_error}
        >
            Add Error
        </button>
    );
    
    if (errors.size === 0) return <AddErrorButton />;
    if (errors.size === 0) return null;
    return <Container error_service={error_service} />;
}

export default Errors;
