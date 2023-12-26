import React from "react";
import { EventTypeClientSessionStateChanged } from "../services/ClientSessionService";
import { useClientSessionService } from "../services";
import { ClientSessionState } from "../services/ClientSessionService/ClientSessionService";

const useClientSessionState = (): ClientSessionState => {
    const client_session_service = useClientSessionService();
    const [state, set_state] = React.useState<ClientSessionState>(client_session_service.get_state);
    React.useEffect(() => {
        const handle_client_session_status_changed = () => {
            set_state(client_session_service.get_state());
        }
        client_session_service.addEventListener(EventTypeClientSessionStateChanged, handle_client_session_status_changed);
        return () => {
            client_session_service.removeEventListener(EventTypeClientSessionStateChanged, handle_client_session_status_changed);
        }
    }, [client_session_service]);
    return state;
}

export default useClientSessionState;
