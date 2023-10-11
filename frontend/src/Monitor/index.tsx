import React from "react";
import "./Monitor.scss";
import Video from "./Video";
import Connection from "./Connection";
import SessionDropdown from "../Sessions/SessionDropdown";
import { EventTypeSessionEnded, Session, SessionEndedEventDetail } from "../Sessions/Sessions";
import SessionsReaderAPI from "../Sessions/SessionsReaderAPI";
import useConnection from "../Connection/useConnection";
import SessionDuration from "./SessionDuration";
import { ClientDisconnectedEventDetail, EventTypeClientDisconnected } from "../Connection/Connection";

const isConnectionLost = (connectionState: RTCPeerConnectionState) => {
    if (connectionState === "disconnected") return true;
    if (connectionState === "failed") return true;
    if (connectionState === "closed") return true;
    return false;
}

const Monitor: React.FunctionComponent = () => {
    const [session, setSession] = React.useState<Session | null>(null);
    const [connection, setConnection] = React.useState<Connection | null>(null);
    const [stream, setStream] = React.useState<MediaStream | null>(null);
    const [sessionEnded, setSessionEnded] = React.useState(false);
    const [connectionState, setConnectionState] = React.useState<RTCPeerConnectionState>("new");

    const signaler = useConnection();
    const sessions = React.useMemo(() => {
        return new SessionsReaderAPI(signaler);
    }, [signaler]);

    React.useEffect(() => {
        const handle = (event: Event) => {
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
        signaler.addEventListener(EventTypeSessionEnded, handle);
        return () => {
            signaler.removeEventListener(EventTypeSessionEnded, handle);
        };
    }, [signaler, session, connection])

    React.useEffect(() => {
        const handle = (event: Event) => {
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
        signaler.addEventListener(EventTypeClientDisconnected, handle);
        return () => {
            signaler.removeEventListener(EventTypeClientDisconnected, handle);
        };
    }, [signaler, session, connection])

    const onSessionChange = React.useCallback((session: Session | null) => {
        setSession(session);
        setStream(null);
        setSessionEnded(false);

        if (connection !== null) {
            connection.close(false);
        }
        if (session === null) return;

        const newConnection = new Connection(signaler, session);
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
    }, [signaler, connection]);

    return (
        <div className="monitor">
            <SessionDropdown sessions={sessions} value={session} onChange={onSessionChange} />
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
                <Video
                    stream={stream}
                    key={session.id}
                />
            )}
        </div>
    );
};

export default Monitor;
