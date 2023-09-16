import { List } from 'immutable';

export interface SessionStartedEventDetail {
    id: string;
    host_connection_id: string;
    name: string
    started_at: string;
}

export interface Session extends SessionStartedEventDetail {

};

export interface SessionEndedEventDetail {
    id: string;
}

export interface StartSessionInput {
    host_connection_id: string;
    session_name: string;
}

export interface EndSessionInput {
    session_id: string;
}

export interface SessionsReader extends EventTarget {
    list(): Promise<List<Session>>;
}

export interface SessionsWriter {
    start(input: StartSessionInput): Promise<Session>;
    end(input: EndSessionInput): Promise<void>;
}

export const EventTypeSessionsChanged = 'sessions.changed';