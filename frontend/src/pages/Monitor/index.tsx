import React from "react";
import { List } from "immutable";
import { Session } from "../../services/SessionListService";
import { ClientSessionStatus } from "../../services/ClientSessionService";
import SessionDropdown from "../../components/SessionDropdown";
import SessionDuration from "./SessionDuration";
import Stream from "./Stream";
import "./Monitor.scss";
import useWakeLock from "../../hooks/useWakeLock";
import client_session_service from "../../instances/client_session_service";
import useClientSessionStatus from "../../hooks/useClientSessionStatus";
import useClientRTCConnectionState from "../../hooks/useClientRTCConnectionState";

const getSessionIfActive = (client_session_status: ClientSessionStatus): Session | null => {
    if (client_session_status.status === "joining") return client_session_status.session;
    if (client_session_status.status === "joined") return client_session_status.session;
    return null;
}

const isClientSessionActive = (client_session_status: ClientSessionStatus["status"]) => {
    if (client_session_status === "joining") return false;
    if (client_session_status === "joined") return true;
    return false;
}

const isConnectionLost = (connectionState: RTCPeerConnectionState) => {
    if (connectionState === "disconnected") return true;
    if (connectionState === "failed") return true;
    if (connectionState === "closed") return true;
    return false;
}

interface Props {
    session_list: List<Session>;
}

const Monitor: React.FunctionComponent<Props> = ({ session_list }) => {
    const client_session_status = useClientSessionStatus();
    const connectionState = useClientRTCConnectionState(client_session_status);

    useWakeLock(isClientSessionActive(client_session_status.status));

    const onSessionChange = React.useCallback((session: Session | null) => {
        client_session_service.leave_session();
        if (session === null) return;
        client_session_service.join_session(session);
    }, []);

    return (
        <div className="monitor">
            <SessionDropdown session_list={session_list} value={getSessionIfActive(client_session_status)} onChange={onSessionChange} />
            {client_session_status.status === 'session_ended' && (
                <div className="alert alert-danger" role="alert">
                    Session Ended
                </div>
            )}
            {client_session_status.status === 'joined' && isConnectionLost(connectionState) && (
                <div className="alert alert-danger" role="alert">
                    Connection Lost
                </div>
            )}
            {client_session_status.status === 'joined' && <SessionDuration startedAt={client_session_status.session.started_at} />}
            {client_session_status.status === 'joined' && <Stream />}
        </div>
    );
};

export default Monitor;
