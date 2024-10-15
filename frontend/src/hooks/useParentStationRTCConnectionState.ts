import React from "react";
import { EventTypeRTCConnectionStateChanged } from "../services/ParentStation/SessionService/Connection/RTCConnection";
import { SessionState } from "../services/ParentStation/SessionService";

const DefaultRTCConnectionState: RTCPeerConnectionState = 'new';

const useClientRTCConnectionState = (session_state: SessionState) => {
    const [connectionState, setConnectionState] = React.useState<RTCPeerConnectionState>(() => {
        if (session_state.state !== 'joined')
            return DefaultRTCConnectionState;
        return session_state.connection.get_rtc_peer_connection_state();
    });
    React.useEffect(() => {
        if (session_state.state !== 'joined') {
            setConnectionState(DefaultRTCConnectionState);
            return;
        }
        const connection = session_state.connection;
        const handle_rtc_connection_state_changed = () => {
            setConnectionState(connection.get_rtc_peer_connection_state());
        }
        connection.addEventListener(EventTypeRTCConnectionStateChanged, handle_rtc_connection_state_changed);
        return () => {
            connection.removeEventListener(EventTypeRTCConnectionStateChanged, handle_rtc_connection_state_changed);
        }
    }, [session_state]);
    return connectionState;
}

export default useClientRTCConnectionState;
