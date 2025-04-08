import React from "react";
import parent_station from "../../services/instances/parent_station";
import { EventTypeStateChanged } from "../../services/Service";
import SessionService, { SessionState } from "../../services/ParentStation/SessionService";
import WebSocketSignalService from "../../services/SignalService/WebSocketSignalService";
import { Session } from "../../services/ParentStation/types";
import useWakeLock from "../../hooks/useWakeLock";
import useServiceState from "../../hooks/useServiceState";
import ConnectionStateAlert from "../../components/ConnectionStateAlert";
// import SessionDropdown from "../../components/SessionDropdown";
import AudioVisualiserComponent from "../../components/AudioVisualiser";
import SessionDuration from "./SessionDuration";
import Video from "./Video";

import "./style.scss";

const getSessionIfActive = (client_session_status: SessionState): Session | null => {
    if (client_session_status.state === "joining") return client_session_status.session;
    if (client_session_status.state === "joined") return client_session_status.session;
    return null;
}

const isClientSessionActive = (client_session_status: SessionState["state"]) => {
    if (client_session_status === "joining") return false;
    if (client_session_status === "joined") return true;
    return false;
}

type UseSignalServiceStopperInput = {
    session_service: SessionService;
    signal_service: WebSocketSignalService;
}

// TODO this shouldn't be a hook
const useStopper = (input: UseSignalServiceStopperInput) => {
    const { session_service, signal_service } = input;
    React.useEffect(() => {
        const handleClientSessionStatusChanged = () => {
            const status = session_service.get_state();
            if (status.state === "session_ended")
                signal_service.stop();
        }

        session_service.addEventListener(EventTypeStateChanged, handleClientSessionStatusChanged);

        return () => {
            session_service.leave_session();
            signal_service.stop();
        }
    }, [signal_service, session_service]);
}

const useSignalService = () => {
    const signal_service = parent_station.signal_service;
    React.useEffect(() => {
        signal_service.start();
        return () => {
            signal_service.stop();
        }
    }, [signal_service]);
    return signal_service;
}

const useBabyStationList = () => {
    React.useEffect(() => {
        parent_station.baby_station_list_service.start();
        return () => {
            parent_station.baby_station_list_service.stop();
        }
    }, []);
    const baby_station_list_state = useServiceState(parent_station.baby_station_list_service);
    return baby_station_list_state.get_baby_station_list();
}

const ParentStation: React.FunctionComponent = () => {
    const session_service = parent_station.session_service;
    const session_state = useServiceState(session_service);
    const signal_service = useSignalService();
    const baby_station_list = useBabyStationList();
    const media_stream_track_state = useServiceState(parent_station.media_stream_track_monitor);
    // const rtc_peer_connection_state = useClientRTCConnectionState(client_session_state);
    // const should_show_stream = client_session_state.state === "joined" && !isBadRTCPeerConnectionState(rtc_peer_connection_state);

    // TODO this shouldn't be a hook
    useWakeLock(isClientSessionActive(session_state.state));

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

    // TODO detect audio-only and empty streams

    return (
        <main className={`container wrapper-content parent-station ${media_stream_track_state}`}>
            {/* <SessionDropdown session_list={session_list} value={getSessionIfActive(session_state)} onChange={onSessionChange} /> */}
            {session_state.state === 'session_ended' && (
                <div id="alert-session-ended" className="alert alert-danger" role="alert">
                    Session Ended
                </div>
            )}
            <ConnectionStateAlert />
            {session_state.state === 'joined' && <SessionDuration started_at={session_state.session.started_at} />}
            {media_stream_track_state === "audio-only" && (
                <React.Fragment>
                    <p id="audio-only-message">Audio only</p>
                    <AudioVisualiserComponent
                        media_stream={parent_station.media_stream}
                        width={640}
                        height={360}
                        className="audio-visualiser"
                    />
                </React.Fragment>
            )}
            <Video />
        </main>
    );
};

export default ParentStation;
