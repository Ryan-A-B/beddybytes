import React from "react";
import { EventTypeRTCConnectionStateChanged } from "../services/ClientSessionService/RTCConnection";
import { ClientSessionState } from "../services/ClientSessionService/ClientSessionService";

const DefaultRTCConnectionState: RTCPeerConnectionState = 'new';

const useClientRTCConnectionState = (client_session_state: ClientSessionState) => {
    const [connectionState, setConnectionState] = React.useState<RTCPeerConnectionState>(() => {
        if (client_session_state.state !== 'joined')
            return DefaultRTCConnectionState;
        return client_session_state.client_connection.get_rtc_peer_connection_state();
    });
    React.useEffect(() => {
        if (client_session_state.state !== 'joined') {
            setConnectionState(DefaultRTCConnectionState);
            return;
        }
        const connection = client_session_state.client_connection;
        const handle_rtc_connection_state_changed = () => {
            setConnectionState(connection.get_rtc_peer_connection_state());
        }
        connection.addEventListener(EventTypeRTCConnectionStateChanged, handle_rtc_connection_state_changed);
        return () => {
            connection.removeEventListener(EventTypeRTCConnectionStateChanged, handle_rtc_connection_state_changed);
        }
    }, [client_session_state]);
    return connectionState;
}

export default useClientRTCConnectionState;
