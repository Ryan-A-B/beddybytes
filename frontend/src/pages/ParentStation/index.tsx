import React from "react";
import SessionDuration from "./SessionDuration";
import useWakeLock from "../../hooks/useWakeLock";
import useParentStationSessionState from "../../hooks/useParentStationSessionStatus";
import useSessionList from "../../hooks/useSessionList";
import useClientRTCConnectionState from "../../hooks/useParentStationRTCConnectionState";
import ConnectionFailed from "../../components/ConnectionFailedAlert";
import SessionDropdown from "../../components/SessionDropdown";
import { useSignalService } from "../../services";
import Stream from "./Stream";

import "./style.scss";
import parent_station from "../../services/instances/parent_station";
import { EventTypeParentStationSessionStateChanged } from "../../services/ParentStation/SessionService";

const getSessionIfActive = (client_session_status: ParentStationSessionState): Session | null => {
    if (client_session_status.state === "joining") return client_session_status.session;
    if (client_session_status.state === "joined") return client_session_status.session;
    return null;
}

const isClientSessionActive = (client_session_status: ParentStationSessionState["state"]) => {
    if (client_session_status === "joining") return false;
    if (client_session_status === "joined") return true;
    return false;
}

const isBadRTCPeerConnectionState = (connection_state: RTCPeerConnectionState): boolean => {
    return connection_state === "failed" || connection_state === "disconnected" || connection_state === "closed";
}

type UseSignalServiceStopperInput = {
    session_service: ParentStationSessionService;
    signal_service: SignalService;
}

const useStopper = (input: UseSignalServiceStopperInput) => {
    const { session_service, signal_service } = input;
    React.useEffect(() => {
        const handleClientSessionStatusChanged = () => {
            const status = session_service.get_state();
            if (status.state === "session_ended")
                signal_service.stop();
        }

        session_service.addEventListener(EventTypeParentStationSessionStateChanged, handleClientSessionStatusChanged);

        return () => {
            session_service.leave_session();
            signal_service.stop();
        }
    }, [signal_service, session_service]);
}

const ParentStation: React.FunctionComponent = () => {
    const session_service = parent_station.session_service;
    const signal_service = useSignalService();
    const client_session_state = useParentStationSessionState();
    const session_list = useSessionList();
    const rtc_peer_connection_state = useClientRTCConnectionState(client_session_state);
    const should_show_stream = client_session_state.state === "joined" && !isBadRTCPeerConnectionState(rtc_peer_connection_state);

    useWakeLock(isClientSessionActive(client_session_state.state));

    const onSessionChange = React.useCallback((session: Session | null) => {
        session_service.leave_session();
        if (session === null) {
            signal_service.stop();
            return;
        }
        signal_service.start();
        session_service.join_session(session);
    }, [signal_service, session_service]);

    useStopper({
        session_service,
        signal_service
    });

    return (
        <div className="parent-station">
            <SessionDropdown session_list={session_list} value={getSessionIfActive(client_session_state)} onChange={onSessionChange} />
            {client_session_state.state === 'session_ended' && (
                <div id="alert-session-ended" className="alert alert-danger" role="alert">
                    Session Ended
                </div>
            )}
            <ConnectionFailed />
            {client_session_state.state === 'joined' && <SessionDuration startedAt={client_session_state.session.started_at} />}
            {should_show_stream && <Stream />}
        </div>
    );
};

export default ParentStation;
