import React from "react";
import { ClientSessionStatus } from "../services/ClientSessionService";
import { EventTypeRTCConnectionStateChanged } from "../services/ClientSessionService/RTCConnection";

const DefaultRTCConnectionState: RTCPeerConnectionState = 'new';

const useClientRTCConnectionState = (client_session_status: ClientSessionStatus) => {
    const [connectionState, setConnectionState] = React.useState<RTCPeerConnectionState>(() => {
        if (client_session_status.status !== 'joined')
            return DefaultRTCConnectionState;
        return client_session_status.rtc_connection.get_connection_status();
    });
    React.useEffect(() => {
        if (client_session_status.status !== 'joined') {
            setConnectionState(DefaultRTCConnectionState);
            return;
        }
        const connection = client_session_status.rtc_connection;
        const handle_rtc_connection_state_changed = () => {
            setConnectionState(connection.get_connection_status());
        }
        connection.addEventListener(EventTypeRTCConnectionStateChanged, handle_rtc_connection_state_changed);
        return () => {
            connection.removeEventListener(EventTypeRTCConnectionStateChanged, handle_rtc_connection_state_changed);
        }
    }, [client_session_status]);
    return connectionState;
}

export default useClientRTCConnectionState;
