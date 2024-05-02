import React from "react"
import useParentStationSessionState from "../hooks/useParentStationSessionStatus";
import useClientRTCConnectionState from "../hooks/useParentStationRTCConnectionState";

const isBadRTCPeerConnectionState = (connection_state: RTCPeerConnectionState): boolean => {
    return connection_state === "failed" || connection_state === "disconnected" || connection_state === "closed";
}

const ConnectionFailed: React.FunctionComponent = () => {
    const client_session_state = useParentStationSessionState();
    const rtc_peer_connection_state = useClientRTCConnectionState(client_session_state);
    if (client_session_state.state !== 'joined') return null;
    if (!isBadRTCPeerConnectionState(rtc_peer_connection_state)) return null;
    return (
        <div className="alert alert-danger" role="alert">
            <div className="row align-items-center">
                <div className="col">
                    Connection failed.
                    <div className="debug-message">
                        {rtc_peer_connection_state}
                    </div>
                </div>
                <div className="col-auto">
                    <button className="btn btn-primary btn-sm" onClick={client_session_state.client_connection.reconnect}>
                        Reconnect
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConnectionFailed
