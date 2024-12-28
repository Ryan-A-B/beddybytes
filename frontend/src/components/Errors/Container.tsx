import React from 'react';
import ErrorService from '../../services/ErrorService';

import Notification from './Notification';
import Alert from './Alert';

interface Props {
    error_service: ErrorService
}

type ShowValue = 'notification' | 'alert';

const Container: React.FunctionComponent<Props> = ({ error_service }) => {
    const [show, setShow] = React.useState<ShowValue>('notification');

    const troubleshoot = React.useCallback(() => {
        setShow('alert');
    }, []);

    if (show === 'notification') return (
        <Notification
            troubleshoot={troubleshoot}
            close={error_service.clear_errors}
        />
    );
    if (show === 'alert') return <Alert error_service={error_service} />;
    throw new Error('invalid show value');
}

export default Container;