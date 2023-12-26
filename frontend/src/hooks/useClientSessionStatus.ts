import React from "react";
import { ClientSessionStatus, EventTypeClientSessionStateChanged } from "../services/ClientSessionService";
import { useClientSessionService } from "../services";

const useClientSessionStatus = (): ClientSessionStatus => {
    const client_session_service = useClientSessionService();
    const [status, set_status] = React.useState<ClientSessionStatus>(client_session_service.get_status);
    React.useEffect(() => {
        const handle_client_session_status_changed = () => {
            set_status(client_session_service.get_status());
        }
        client_session_service.addEventListener(EventTypeClientSessionStateChanged, handle_client_session_status_changed);
        return () => {
            client_session_service.removeEventListener(EventTypeClientSessionStateChanged, handle_client_session_status_changed);
        }
    }, [client_session_service]);
    return status;
}

export default useClientSessionStatus;
