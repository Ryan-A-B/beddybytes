import { Map, List } from "immutable";
import moment from "moment";
import eventstore from "../../../eventstore";
import { Session } from "./types";

const WebSocketCloseCodeNormalClosure = 1000;
const WebSocketCloseCodeGoingAway = 1001;
// const WebSocketCloseCodeProtocolError = 1002;
// const WebSocketCloseCodeUnsupportedData = 1003;
// const WebSocketCloseCodeNoStatus = 1005;
// const WebSocketCloseCodeAbnormalClosure = 1006;

const expected_web_socket_close_codes = [
    WebSocketCloseCodeNormalClosure, // Manually closed by the user
    WebSocketCloseCodeGoingAway,     // Automatically sent by the browser when the tab is closed
];

interface SessionStartedEventData {
    id: string;
    host_connection_id: string;
    name: string
    started_at: string;
}

interface SessionStartedEvent extends eventstore.Event<SessionStartedEventData> {
    type: 'session.started';
}

interface SessionEndedEventData {
    id: string;
}

interface SessionEndedEvent extends eventstore.Event<SessionEndedEventData> {
    type: 'session.ended';
}

interface ClientConnectedEventData {
    client_id: string;
    connection_id: string;
    request_id: string;
}

interface ClientConnectedEvent extends eventstore.Event<ClientConnectedEventData> {
    type: 'client.connected';
}

interface ClientDisconnectedEventData {
    client_id: string;
    connection_id: string;
    request_id: string;
    web_socket_close_code: number;
}

interface ClientDisconnectedEvent extends eventstore.Event<ClientDisconnectedEventData> {
    type: 'client.disconnected';
}

interface ServerStartedEvent extends eventstore.Event<null> {
}

class SessionList {
    private sessionByID: Map<string, Session> = Map();
    private sessionByConnectionID: Map<string, Session> = Map();

    public seed = (sessions: Session[]) => {
        sessions.forEach(this.set_session);
    }

    public get_session_list = (): List<Session> => {
        return this.sessionByID.toList();
    }

    public apply = (event: eventstore.Event): boolean => {
        switch (event.type) {
            case 'session.started':
                return this.apply_session_started_event(event as SessionStartedEvent);
            case 'session.ended':
                return this.apply_session_ended_event(event as SessionEndedEvent);
            case 'client.connected':
                return this.apply_client_connected_event(event as ClientConnectedEvent);
            case 'client.disconnected':
                return this.apply_client_disconnected_event(event as ClientDisconnectedEvent);
            case 'server.started':
                return this.apply_server_started_event(event as ServerStartedEvent);
            default:
                return false;
        }
    }

    private set_session = (session: Session) => {
        this.sessionByID = this.sessionByID.set(session.id, session);
        this.sessionByConnectionID = this.sessionByConnectionID.set(session.host_connection_id, session);
    }

    private delete_session = (session: Session) => {
        this.sessionByID = this.sessionByID.delete(session.id);
        this.sessionByConnectionID = this.sessionByConnectionID.delete(session.host_connection_id);
    }

    private apply_session_started_event = (event: SessionStartedEvent): boolean => {
        const session: Session = {
            id: event.data.id,
            name: event.data.name,
            host_connection_id: event.data.host_connection_id,
            started_at: moment(event.data.started_at, eventstore.MomentFormatRFC3339),
            host_connection_state: {
                state: 'connected',
                request_id: 'TODO', // TODO
                since: moment(event.unix_timestamp, eventstore.MomentFormatUnixTimestamp), // TODO this is the session started timestamp, not the host connected timestamp
            },
        };
        const existing_session = this.sessionByConnectionID.get(session.host_connection_id);
        if (existing_session !== undefined)
            this.delete_session(existing_session);
        this.set_session(session);
        return true;
    }

    private apply_session_ended_event = (event: SessionEndedEvent): boolean => {
        const session = this.sessionByID.get(event.data.id);
        if (session === undefined) return false;
        this.delete_session(session);
        return true;
    }

    private apply_client_connected_event = (event: ClientConnectedEvent): boolean => {
        const session = this.sessionByConnectionID.get(event.data.connection_id);
        if (session === undefined) return false;
        const updated_session: Session = {
            ...session,
            host_connection_state: {
                state: 'connected',
                request_id: event.data.request_id,
                since: moment(event.unix_timestamp, eventstore.MomentFormatUnixTimestamp),
            },
        };
        this.set_session(updated_session);
        return true;
    }

    private apply_client_disconnected_event = (event: ClientDisconnectedEvent): boolean => {
        const session = this.sessionByConnectionID.get(event.data.connection_id);
        if (session === undefined) return false;
        if (session.host_connection_state.state !== 'connected') return false;
        if (session.host_connection_state.request_id !== event.data.request_id) return false;
        const expected_web_socket_close_code_received = expected_web_socket_close_codes.includes(event.data.web_socket_close_code);
        if (!expected_web_socket_close_code_received) {
            const updated_session: Session = {
                ...session,
                host_connection_state: {
                    state: 'disconnected',
                    since: moment(event.unix_timestamp, eventstore.MomentFormatUnixTimestamp),
                },
            };
            this.set_session(updated_session);
            return true;
        }
        this.delete_session(session);
        return true;
    }

    private apply_server_started_event = (event: ServerStartedEvent): boolean => {
        if (this.sessionByConnectionID.isEmpty()) return false;
        const since = moment(event.unix_timestamp, eventstore.MomentFormatUnixTimestamp);
        this.sessionByConnectionID.forEach((session) => {
            if (session.host_connection_state.state === 'disconnected') return;
            const updated_session: Session = {
                ...session,
                host_connection_state: {
                    state: 'disconnected',
                    since: since,
                },
            };
            this.set_session(updated_session);
        });
        return true;
    }
}

export default SessionList;