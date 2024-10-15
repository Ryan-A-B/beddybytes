import React from "react"
import useClientRTCConnectionState from "../hooks/useParentStationRTCConnectionState";
import useServiceState from "../hooks/useServiceState";
import parent_station from "../services/instances/parent_station";

const isBadRTCPeerConnectionState = (connection_state: RTCPeerConnectionState): boolean => {
    return connection_state === "failed" || connection_state === "disconnected" || connection_state === "closed";
}

const ConnectionFailed: React.FunctionComponent = () => {
    const session_state = useServiceState(parent_station.session_service);
    const rtc_peer_connection_state = useClientRTCConnectionState(session_state);
    if (session_state.state !== 'joined') return null;
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
                    <button className="btn btn-primary btn-sm" onClick={session_state.connection.reconnect}>
                        Reconnect
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConnectionFailed
