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
    if (errors.size === 0) return null;
    return <Container error_service={error_service} />;
}

export default Errors;
