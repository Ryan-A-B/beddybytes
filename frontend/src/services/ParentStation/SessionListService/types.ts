import { List } from 'immutable';
import moment from 'moment';
import SessionListProjection from './SessionListProjection';
import Service from '../../Service';

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

export type SessionListServiceState = List<Session>;

export interface SessionListService extends Service<SessionListServiceState> {
    start(): void;
}