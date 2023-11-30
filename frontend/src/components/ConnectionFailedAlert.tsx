import React from "react"
import useClientSessionStatus from "../hooks/useClientSessionStatus";
import useClientRTCConnectionState from "../hooks/useClientRTCConnectionState";

const isBadRTCPeerConnectionState = (connection_state: RTCPeerConnectionState): boolean => {
    return connection_state === "failed" || connection_state === "disconnected" || connection_state === "closed";
}

const ConnectionFailed: React.FunctionComponent = () => {
    const client_session_status = useClientSessionStatus();
    const connection_state = useClientRTCConnectionState(client_session_status);
    if (client_session_status.status !== 'joined') return null;
    if (!isBadRTCPeerConnectionState(connection_state)) return null;
    return (
        <div className="alert alert-danger" role="alert">
            <div className="row align-items-center">
                <div className="col">
                    Connection failed.
                    <div className="debug-message">
                        {connection_state}
                    </div>
                </div>
                <div className="col-auto">
                    <button className="btn btn-primary btn-sm" onClick={client_session_status.rtc_connection.reconnect}>
                        Reconnect
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConnectionFailed
