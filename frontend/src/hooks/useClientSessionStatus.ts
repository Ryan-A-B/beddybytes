import React from "react";
import { ClientSessionStatus, EventTypeClientSessionStatusChanged } from "../services/ClientSessionService";
import client_session_service from "../instances/client_session_service";

const useClientSessionStatus = (): ClientSessionStatus => {
    const [status, set_status] = React.useState<ClientSessionStatus>(client_session_service.get_status);
    React.useEffect(() => {
        const handle_client_session_status_changed = () => {
            set_status(client_session_service.get_status());
        }
        client_session_service.addEventListener(EventTypeClientSessionStatusChanged, handle_client_session_status_changed);
        return () => {
            client_session_service.removeEventListener(EventTypeClientSessionStatusChanged, handle_client_session_status_changed);
        }
    }, []);
    return status;
}

export default useClientSessionStatus;
