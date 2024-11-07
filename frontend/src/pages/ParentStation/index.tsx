import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faStop } from "@fortawesome/free-solid-svg-icons";
import { useSignalService } from "../../services";
import parent_station from "../../services/instances/parent_station";
import { Session } from "../../services/ParentStation/SessionListService/types";
import SessionService, { SessionState } from "../../services/ParentStation/SessionService";
import { EventTypeStateChanged } from "../../services/Service";
import logging_service from "../../services/instances/logging_service";
import { Severity } from "../../services/LoggingService";
import useWakeLock from "../../hooks/useWakeLock";
import useSessionList from "../../hooks/useSessionList";
import useServiceState from "../../hooks/useServiceState";
import ConnectionStateAlert from "../../components/ConnectionStateAlert";
import SessionDropdown from "../../components/SessionDropdown";
import AudioVisualiserComponent from "../../components/AudioVisualiser";
import SessionDuration from "./SessionDuration";

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
    signal_service: SignalService;
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

const usePlay = (video_element_ref: React.RefObject<HTMLVideoElement>) => {
    const session_state = useServiceState(parent_station.session_service);
    React.useLayoutEffect(() => {
        const video_element = video_element_ref.current;
        if (video_element === null) return;
        if (session_state.state !== "joined") return;
        const connection = session_state.connection;
        const handle_connection_state_change = () => {
            const connection_state = connection.get_state();
            if (connection_state.state !== "connected") return;
            if (!video_element.paused) return;
            video_element.play().catch((error: unknown) => {
                const is_error = error instanceof Error;
                if (!is_error) {
                    logging_service.log({
                        severity: Severity.Critical,
                        message: `Error playing video element in ParentStation usePlay: ${error}`,
                    })
                    return;
                }
                logging_service.log({
                    severity: Severity.Critical,
                    message: `Error playing video element in ParentStation usePlay: ${error.message} ${error.stack}`,
                })
            });
        }
        connection.addEventListener("state_changed", handle_connection_state_change);
        return () => {
            connection.removeEventListener("state_changed", handle_connection_state_change);
        }
    }, [video_element_ref, session_state]);
}

const ParentStation: React.FunctionComponent = () => {
    const session_service = parent_station.session_service;
    const signal_service = useSignalService();
    const session_state = useServiceState(session_service);
    const session_list = useSessionList();
    const recording_state = useServiceState(parent_station.recording_service);
    const media_stream_track_state = useServiceState(parent_station.media_stream_track_monitor);
    // const rtc_peer_connection_state = useClientRTCConnectionState(client_session_state);
    // const should_show_stream = client_session_state.state === "joined" && !isBadRTCPeerConnectionState(rtc_peer_connection_state);

    const video_element_ref = React.useRef<HTMLVideoElement>(null);
    React.useLayoutEffect(() => {
        const video_element = video_element_ref.current;
        if (video_element === null) return;
        video_element.srcObject = parent_station.media_stream;
    }, [video_element_ref]);

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

    usePlay(video_element_ref);

    // TODO detect audio-only and empty streams

    return (
        <main className={`container wrapper-content parent-station ${media_stream_track_state}`}>
            <SessionDropdown session_list={session_list} value={getSessionIfActive(session_state)} onChange={onSessionChange} />
            {session_state.state === 'session_ended' && (
                <div id="alert-session-ended" className="alert alert-danger" role="alert">
                    Session Ended
                </div>
            )}
            <ConnectionStateAlert />
            {session_state.state === 'joined' && <SessionDuration startedAt={session_state.session.started_at} />}
            {recording_state.state === 'not_recording' && (
                <button id="button-start-recording" onClick={parent_station.recording_service.start} className='btn btn-outline-danger'>
                    <FontAwesomeIcon icon={faCircle} /> Start Recording
                </button>
            )}
            {recording_state.state === 'recording' && (
                <button id="button-stop-recording" onClick={parent_station.recording_service.stop} className='btn btn-outline-success'>
                    <FontAwesomeIcon icon={faStop} /> Stop Recording
                </button>
            )}
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
            <video
                id="video-parent-station"
                ref={video_element_ref}
                className="video mt-3"
                playsInline
            />
        </main>
    );
};

export default ParentStation;
