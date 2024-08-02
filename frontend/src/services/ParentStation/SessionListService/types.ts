import { List } from 'immutable';
import moment from 'moment';

export interface HostConnectionStateConnected {
    state: 'connected';
    request_id: string;
    since: moment.Moment;
}

export interface HostConnectionStateDisconnected {
    state: 'disconnected';
    since: moment.Moment;
}

export type HostConnectionState = HostConnectionStateConnected | HostConnectionStateDisconnected;

export interface Session {
    id: string;
    name: string
    host_connection_id: string;
    started_at: moment.Moment;
    host_connection_state: HostConnectionState;
}

export interface SessionListService extends EventTarget {
    get_session_list: () => List<Session>;
}

export const EventTypeSessionListChanged = 'sessions_changed';