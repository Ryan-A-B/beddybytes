import React from "react";
import { EventTypeClientSessionStateChanged } from "../../services/ClientSessionService";
import SessionDuration from "./SessionDuration";
import useWakeLock from "../../hooks/useWakeLock";
import useClientSessionStatus from "../../hooks/useClientSessionStatus";
import useSessionList from "../../hooks/useSessionList";
import useClientRTCConnectionState from "../../hooks/useClientRTCConnectionState";
import ConnectionFailed from "../../components/ConnectionFailedAlert";
import SessionDropdown from "../../components/SessionDropdown";
import Stream from "./Stream";

import "./Monitor.scss";
import { useClientSessionService, useSignalService } from "../../services";

const getSessionIfActive = (client_session_status: ClientSessionState): Session | null => {
    if (client_session_status.state === "joining") return client_session_status.session;
    if (client_session_status.state === "joined") return client_session_status.session;
    return null;
}

const isClientSessionActive = (client_session_status: ClientSessionState["state"]) => {
    if (client_session_status === "joining") return false;
    if (client_session_status === "joined") return true;
    return false;
}

const isBadRTCPeerConnectionState = (connection_state: RTCPeerConnectionState): boolean => {
    return connection_state === "failed" || connection_state === "disconnected" || connection_state === "closed";
}

type UseClientSignalServiceStopperInput = {
    client_session_service: ClientSessionService;
    signal_service: SignalService;
}

const useClientSignalServiceStopper = ({ client_session_service, signal_service }: UseClientSignalServiceStopperInput) => {
    React.useEffect(() => {
        const handleClientSessionStatusChanged = () => {
            const status = client_session_service.get_state();
            if (status.state === "session_ended")
                signal_service.stop();
        }

        client_session_service.addEventListener(EventTypeClientSessionStateChanged, handleClientSessionStatusChanged);

        return () => {
            client_session_service.leave_session();
            signal_service.stop();
        }
    }, [signal_service, client_session_service]);
}

const Monitor: React.FunctionComponent = () => {
    const client_session_service = useClientSessionService();
    const signal_service = useSignalService();
    const client_session_status = useClientSessionStatus();
    const session_list = useSessionList();
    const connection_state = useClientRTCConnectionState(client_session_status);
    const should_show_stream = client_session_status.status === "joined" && !isBadRTCPeerConnectionState(connection_state);

    useWakeLock(isClientSessionActive(client_session_status.status));

    const onSessionChange = React.useCallback((session: Session | null) => {
        client_session_service.leave_session();
        if (session === null) {
            signal_service.stop();
            return;
        }
        signal_service.start();
        client_session_service.join_session(session);
    }, [signal_service, client_session_service]);

    useClientSignalServiceStopper({
        client_session_service,
        signal_service
    });

    return (
        <div className="monitor">
            <SessionDropdown session_list={session_list} value={getSessionIfActive(client_session_status)} onChange={onSessionChange} />
            {client_session_status.status === 'session_ended' && (
                <div className="alert alert-danger" role="alert">
                    Session Ended
                </div>
            )}
            <ConnectionFailed />
            {client_session_status.status === 'joined' && <SessionDuration startedAt={client_session_status.session.started_at} />}
            {should_show_stream && <Stream />}
        </div>
    );
};

export default Monitor;
