import { Map, List } from "immutable";
import EventService, { EventTypeEventServiceStatusChanged } from "./EventService";
import eventstore from "../eventstore";

const WebSocketCloseCodeAbnormalClosure = 1006;

export const EventTypeSessionListChanged = 'sessions_changed';

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
}

interface ClientConnectedEvent extends eventstore.Event<ClientConnectedEventData> {
    type: 'client.connected';
}

interface ClientDisconnectedEventData {
    client_id: string;
    connection_id: string;
    web_socket_close_code: number;
}

interface ClientDisconnectedEvent extends eventstore.Event<ClientDisconnectedEventData> {
    type: 'client.disconnected';
}

export interface Session {
    id: string;
    name: string
    host_connection_id: string;
    started_at: string;
    connected: boolean;
}

interface NewSessionServiceInput {
    event_service: EventService;
}

class SessionListService extends EventTarget {
    private event_service: EventService;
    private sessionByID: Map<string, Session> = Map();
    private sessionByConnectionID: Map<string, Session> = Map();
    private projecting: boolean = false;

    constructor(input: NewSessionServiceInput) {
        super();
        this.event_service = input.event_service;
        const event_service_status = this.event_service.get_status();
        if (event_service_status.status === 'loading') {
            this.event_service.addEventListener(EventTypeEventServiceStatusChanged, this.handle_event_service_status_changed);
            return;
        }
        const event_store = event_service_status.event_store;
        this.project_sessions(event_store);
    }

    public get_session_list = (): List<Session> => {
        return this.sessionByID.toList();
    }

    private handle_event_service_status_changed = async () => {
        const event_service_status = this.event_service.get_status();
        if (event_service_status.status !== 'ready')
            return;
        const event_store = event_service_status.event_store;
        await this.project_sessions(event_store);
    }

    private project_sessions = async (event_store: eventstore.EventStore) => {
        if (this.projecting)
            throw new Error("Already projecting");
        this.projecting = true;
        for await (const event of event_store.get_events({ from_cursor: 0 })) {
            this.apply_event(event);
        }
    }

    private apply_event(event: eventstore.Event<unknown>) {
        switch (event.type) {
            case 'session.started':
                return this.apply_session_started_event(event as SessionStartedEvent);
            case 'session.ended':
                return this.apply_session_ended_event(event as SessionEndedEvent);
            case 'client.connected':
                return this.apply_client_connected_event(event as ClientConnectedEvent);
            case 'client.disconnected':
                return this.apply_client_disconnected_event(event as ClientDisconnectedEvent);
        }
    }

    private set_session = (session: Session) => {
        this.sessionByID = this.sessionByID.set(session.id, session);
        this.sessionByConnectionID = this.sessionByConnectionID.set(session.host_connection_id, session);
        this.dispatchEvent(new Event(EventTypeSessionListChanged));
    }

    private delete_session = (session: Session) => {
        this.sessionByID = this.sessionByID.delete(session.id);
        this.sessionByConnectionID = this.sessionByConnectionID.delete(session.host_connection_id);
        this.dispatchEvent(new Event(EventTypeSessionListChanged));
    }

    private apply_session_started_event(event: SessionStartedEvent) {
        const session = {
            id: event.data.id,
            name: event.data.name,
            host_connection_id: event.data.host_connection_id,
            started_at: event.data.started_at,
            connected: true, // TODO keep track of connections?
        };
        const existing_session = this.sessionByConnectionID.get(session.host_connection_id);
        if (existing_session !== undefined)
            this.delete_session(existing_session);
        this.set_session(session);
    }

    private apply_session_ended_event(event: SessionEndedEvent) {
        const session = this.sessionByID.get(event.data.id);
        if (session === undefined) return;
        this.delete_session(session);
    }

    private apply_client_connected_event(event: ClientConnectedEvent) {
        const session = this.sessionByConnectionID.get(event.data.connection_id);
        if (session === undefined) return;
        if (session.connected) return;
        const updated_session = {
            ...session,
            connected: true,
        };
        this.set_session(updated_session);
    }

    private apply_client_disconnected_event(event: ClientDisconnectedEvent) {
        const session = this.sessionByConnectionID.get(event.data.connection_id);
        if (session === undefined) return;
        const abnormal_closure = event.data.web_socket_close_code === WebSocketCloseCodeAbnormalClosure;
        if (abnormal_closure) {
            if (!session.connected) return;
            const updated_session = {
                ...session,
                connected: false,
            };
            this.set_session(updated_session);
            return;
        }
        this.delete_session(session);
    }
}

export default SessionListService;
