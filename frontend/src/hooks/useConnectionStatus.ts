import React from 'react';
import { ConnectionStatus, EventTypeConnectionStatusChanged } from "../services/ConnectionService";
import connection_service from "../instances/connection_service";

const useConnectionStatus = (): ConnectionStatus => {
    const [status, set_status] = React.useState<ConnectionStatus>(connection_service.get_status());

    React.useEffect(() => {
        const handle_connection_status_changed = () => {
            set_status(connection_service.get_status());
        }
        connection_service.addEventListener(EventTypeConnectionStatusChanged, handle_connection_status_changed);
        return () => {
            connection_service.removeEventListener(EventTypeConnectionStatusChanged, handle_connection_status_changed);
        }
    }, []);

    return status;
}

export default useConnectionStatus;
