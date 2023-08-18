import { List } from 'immutable';

export interface Session {
    id: string;
    host_client_id: string;
    name: string
    started_at: string;
}

export interface StartSessionInput {
    client_id: string;
    session_name: string;
}

export interface EndSessionInput {
    session_id: string;
}

export interface Sessions extends EventTarget {
    list(): List<Session>;
    start(input: StartSessionInput): Session;
    end(input: EndSessionInput): void;
}

export const EventTypeSessionsChanged = 'sessions.changed';

export class SessionsChangedEvent extends Event {
    sessions: List<Session>;
    constructor(sessions: List<Session>) {
        super(EventTypeSessionsChanged);
        this.sessions = sessions;
    }
}