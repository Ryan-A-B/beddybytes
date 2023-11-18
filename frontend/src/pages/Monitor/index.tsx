import React from "react";
import { List } from "immutable";
import { Session } from "../../services/SessionListService";
import SessionDropdown from "../../Sessions/SessionDropdown";
import { ClientDisconnectedEventDetail, EventTypeClientDisconnected } from "../../Connection/Connection";
import { Connection, ConnectionFactory } from "./Connection";
import SessionDuration from "./SessionDuration";
import Stream from "./Stream";
import "./Monitor.scss";
import useConnectionStatus from "../../hooks/useConnectionStatus";
import useWakeLock from "../../hooks/useWakeLock";
import { EventTypeSessionEnded, SessionEndedEventDetail } from "../../Sessions/Sessions";

const isConnectionLost = (connectionState: RTCPeerConnectionState) => {
    if (connectionState === "disconnected") return true;
    if (connectionState === "failed") return true;
    if (connectionState === "closed") return true;
    return false;
}

interface Props {
    factory: ConnectionFactory;
    session_list: List<Session>;
}

const Monitor: React.FunctionComponent<Props> = ({ factory, session_list }) => {
    const connection_status = useConnectionStatus();
    const [session, setSession] = React.useState<Session | null>(null);
    const [connection, setConnection] = React.useState<Connection | null>(null);
    const [stream, setStream] = React.useState<MediaStream | null>(null);
    const [sessionEnded, setSessionEnded] = React.useState(false);
    const [connectionState, setConnectionState] = React.useState<RTCPeerConnectionState>("new");

    useWakeLock(session !== null);

    React.useEffect(() => {
        if (connection_status.status === "not_connected") return;
        const handle_session_ended = (event: Event) => {
            if (session === null) return;
            if (connection === null) return;
            if (!(event instanceof CustomEvent)) throw new Error("event is not a CustomEvent");
            const detail = event.detail as SessionEndedEventDetail;
            if (detail.id !== session.id) return;
            connection.close(true);
            setSession(null);
            setStream(null);
            setConnection(null);
            setSessionEnded(true)
        }
        const handle_client_disconnected = (event: Event) => {
            if (session === null) return;
            if (connection === null) return;
            if (!(event instanceof CustomEvent)) throw new Error("event is not a CustomEvent");
            const detail = event.detail as ClientDisconnectedEventDetail;
            if (detail.connection_id !== session.host_connection_id) return;
            if (detail.web_socket_close_code === 1006) return;
            connection.close(true);
            setSession(null);
            setStream(null);
            setConnection(null);
            setSessionEnded(true)
        }
        const signaler = connection_status.connection;
        signaler.addEventListener(EventTypeSessionEnded, handle_session_ended);
        signaler.addEventListener(EventTypeClientDisconnected, handle_client_disconnected);
        return () => {
            signaler.removeEventListener(EventTypeSessionEnded, handle_session_ended);
            signaler.removeEventListener(EventTypeClientDisconnected, handle_client_disconnected);
        };
    }, [connection_status, session, connection])

    const onSessionChange = React.useCallback((session: Session | null) => {
        setSession(session);
        setStream(null);
        setSessionEnded(false);

        if (connection !== null) {
            connection.close(false);
        }
        if (session === null) return;

        const newConnection = factory.create(session);
        newConnection.ontrack = (event: RTCTrackEvent) => {
            const stream = event.streams[0];
            setStream(stream);
        }
        newConnection.onconnectionstatechange = (event: Event) => {
            if (event.type !== "connectionstatechange") throw new Error("event.type is not connectionstatechange");
            const connection = event.target as RTCPeerConnection;
            setConnectionState(connection.connectionState);
        }
        setConnection(newConnection);
    }, [factory, connection]);

    return (
        <div className="monitor">
            <SessionDropdown session_list={session_list} value={session} onChange={onSessionChange} />
            {sessionEnded && (
                <div className="alert alert-danger" role="alert">
                    Session Ended
                </div>
            )}
            {!sessionEnded && isConnectionLost(connectionState) && (
                <div className="alert alert-danger" role="alert">
                    Connection Lost
                </div>
            )}
            {session && <SessionDuration startedAt={session.started_at} />}
            {session && stream && (
                <Stream
                    stream={stream}
                    key={session.id}
                />
            )}
        </div>
    );
};

export default Monitor;
