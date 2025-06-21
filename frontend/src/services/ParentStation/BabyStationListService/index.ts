import { Map, List } from 'immutable';
import moment from 'moment';
import settings from '../../../settings';
import Service, { SetStateFunction } from '../../Service';
import LoggingService, { Severity } from '../../LoggingService';
import isClientError from '../../../utils/isClientError';
import sleep from '../../../utils/sleep';
import EventStreamService from './EventStreamService';
import { EventConnectedEvent, EventDisconnectedEvent, ServerStartedEvent, SessionEndedEvent, SessionStartedEvent } from './EventStreamService/event';
import { BabyStation, Connection, Session } from '../types';

interface ForFriends {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    event_stream_service: EventStreamService;
    set_state: SetStateFunction<BabyStationListState>;
    load_snapshot: (snapshot: Snapshot) => void;
}

abstract class AbstractState {
    public abstract name: string;
    public abstract start: (service: ForFriends) => Promise<void>;
    public abstract stop: (service: ForFriends) => Promise<void>;
    public abstract get_snapshot: () => Snapshot;

    public get_baby_station_list = (): List<BabyStation> => {
        return get_baby_station_list(this.get_snapshot());
    }

    public abstract load_snapshot: (service: ForFriends, snapshot: Snapshot) => void;

    public handle_session_started = (service: ForFriends, event: SessionStartedEvent): void => {
        // do nothing
    }

    public handle_session_ended = (service: ForFriends, event: SessionEndedEvent): void => {
        // do nothing
    }

    public handle_client_connected = (service: ForFriends, event: EventConnectedEvent): void => {
        // do nothing
    }

    public handle_client_disconnected = (service: ForFriends, event: EventDisconnectedEvent): void => {
        // do nothing
    }

    public handle_server_started = (service: ForFriends, event: ServerStartedEvent): void => {
        // do nothing
    }
}

class NotStarted extends AbstractState {
    public readonly name = 'not_started';

    public start = async (service: ForFriends): Promise<void> => {
        service.set_state(new LoadingSnapshot());
        const snapshot = await this.fetch_snapshot(service);
        service.load_snapshot(snapshot);
    }

    public stop = async (service: ForFriends): Promise<void> => {
        // do nothing
    }

    public load_snapshot = (service: ForFriends, snapshot: Snapshot): void => {
        throw new Error("load_snapshot should not be called when not started");
    }

    public get_snapshot = (): Snapshot => {
        return EmptySnapshot;
    }

    private fetch_snapshot = async (service: ForFriends): Promise<Snapshot> => {
        const access_token = await service.authorization_service.get_access_token();
        const endpoint = `https://${settings.API.host}/baby_station_list_snapshot`;
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });
        if (!response.ok) {
            const payload = await response.text();
            if (isClientError(response.status))
                throw new Error(`Failed to list sessions: ${payload}`);
            service.logging_service.log({
                severity: Severity.Error,
                message: `Failed to list sessions: ${payload}`,
            });
            await sleep(5000);
            return this.fetch_snapshot(service);
        }
        const output = await response.json() as GetSnapshotOutput;
        const session_by_id = Map<string, Session>(
            Object.entries(output.session_by_id).map(([key, value]) => [
                key,
                {
                    id: value.id,
                    name: value.name,
                    started_at: moment(value.started_at),
                    host_connection_id: value.host_connection_id,
                },
            ]),
        );
        return {
            cursor: output.cursor,
            session_by_id,
            session_id_by_connection_id: Map<string, string>(output.session_id_by_connection_id),
            connection_by_id: Map<string, Connection>(output.connection_by_id),
        };
    }
}

abstract class Running extends AbstractState {
    public start = async (service: ForFriends): Promise<void> => {
        throw new Error('Cannot start when already running');
    }
}

class LoadingSnapshot extends Running {
    public readonly name = 'loading_snapshot';

    public stop = async (service: ForFriends): Promise<void> => {
        service.set_state(new PausedWaitingForSnapshot());
    }

    public load_snapshot = (service: ForFriends, snapshot: Snapshot): void => {
        service.event_stream_service.start(snapshot.cursor);
        service.set_state(new Projecting(snapshot));
    }

    public get_snapshot = (): Snapshot => {
        return EmptySnapshot;
    }
}

class Projecting extends Running {
    public readonly name = 'projecting';
    private readonly snapshot: Snapshot;

    constructor(snapshot: Snapshot) {
        super();
        this.snapshot = snapshot;
    }

    public stop = async (service: ForFriends): Promise<void> => {
        service.event_stream_service.stop();
        service.set_state(new Paused(this.snapshot));
    }

    public load_snapshot = (service: ForFriends, snapshot: Snapshot): void => {
        throw new Error("load_snapshot should not be called when projecting");
    }

    public get_snapshot = (): Snapshot => {
        return this.snapshot;
    }

    public handle_session_started = (service: ForFriends, event: SessionStartedEvent): void => {
        service.set_state(new Projecting({
            ...this.snapshot,
            session_by_id: this.snapshot.session_by_id.set(event.data.id, {
                id: event.data.id,
                name: event.data.name,
                started_at: moment(event.data.started_at),
                host_connection_id: event.data.host_connection_id,
            }),
            session_id_by_connection_id: this.snapshot.session_id_by_connection_id.set(event.data.host_connection_id, event.data.id),
            cursor: event.logical_clock,
        }));
    }

    public handle_session_ended = (service: ForFriends, event: SessionEndedEvent): void => {
        const session = this.snapshot.session_by_id.get(event.data.id);
        if (session === undefined) return;
        service.set_state(new Projecting({
            ...this.snapshot,
            session_by_id: this.snapshot.session_by_id.delete(session.id),
            session_id_by_connection_id: this.snapshot.session_id_by_connection_id.delete(session.host_connection_id),
            cursor: event.logical_clock,
        }));
    }

    public handle_client_connected = (service: ForFriends, event: EventConnectedEvent): void => {
        service.set_state(new Projecting({
            ...this.snapshot,
            cursor: event.logical_clock,
            connection_by_id: this.snapshot.connection_by_id.set(event.data.connection_id, {
                client_id: event.data.client_id,
                id: event.data.connection_id,
                request_id: event.data.request_id,
            }),
        }));
    }

    public handle_client_disconnected = (service: ForFriends, event: EventDisconnectedEvent): void => {
        service.set_state(new Projecting({
            ...this.snapshot,
            connection_by_id: this.snapshot.connection_by_id.delete(event.data.connection_id),
            cursor: event.logical_clock,
        }));
    }

    public handle_server_started = (service: ForFriends, event: ServerStartedEvent): void => {
        service.set_state(new Projecting({
            ...this.snapshot,
            cursor: event.logical_clock,
            connection_by_id: Map(),
        }));
    }
}

class Paused extends AbstractState {
    public readonly name = 'paused';
    protected snapshot: Snapshot;

    constructor(snapshot: Snapshot) {
        super();
        this.snapshot = snapshot;
        console.log(this.snapshot)
    }

    public start = async (service: ForFriends): Promise<void> => {
        service.event_stream_service.start(this.snapshot.cursor);
        service.set_state(new Projecting(this.snapshot));
    }

    public stop = async (service: ForFriends): Promise<void> => {
        throw new Error('Cannot stop when paused');
    }

    public load_snapshot = (service: ForFriends, snapshot: Snapshot): void => {
        service.set_state(new Paused(snapshot));
    }

    public get_snapshot = (): Snapshot => {
        return this.snapshot;
    }
}

class PausedWaitingForSnapshot extends AbstractState {
    public readonly name = 'paused_waiting_for_snapshot';

    public start = async (service: ForFriends): Promise<void> => {
        service.set_state(new LoadingSnapshot());
    }

    public stop = async (service: ForFriends): Promise<void> => {
        throw new Error('Cannot stop when paused_waiting_for_snapshot');
    }

    public load_snapshot = (service: ForFriends, snapshot: Snapshot): void => {
        service.set_state(new Paused(snapshot));
    }

    public get_snapshot = (): Snapshot => {
        return EmptySnapshot;
    }
}

export type BabyStationListState = NotStarted | LoadingSnapshot | Projecting | Paused | PausedWaitingForSnapshot;

interface NewBabyStationListServiceInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

class BabyStationListService extends Service<BabyStationListState> {
    public readonly name = 'BabyStationListService';
    private readonly event_stream_service: EventStreamService;
    private readonly proxy: ForFriends;

    constructor(input: NewBabyStationListServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: new NotStarted(),
        });
        this.event_stream_service = new EventStreamService({
            logging_service: input.logging_service,
            authorization_service: input.authorization_service,
        });
        this.event_stream_service.addEventListener('session.started', this.handle_session_started);
        this.event_stream_service.addEventListener('session.ended', this.handle_session_ended);
        this.event_stream_service.addEventListener('client.connected', this.handle_client_connected);
        this.event_stream_service.addEventListener('client.disconnected', this.handle_client_disconnected);
        this.event_stream_service.addEventListener('server.started', this.handle_server_started);
        this.proxy = {
            logging_service: input.logging_service,
            authorization_service: input.authorization_service,
            event_stream_service: this.event_stream_service,
            set_state: this.set_state,
            load_snapshot: this.load_snapshot,
        };
    }

    protected to_string = (state: BabyStationListState): string => {
        return state.name;
    }

    public start = (): void => {
        const state = this.get_state();
        state.start(this.proxy);
    }

    public stop = (): void => {
        const state = this.get_state();
        state.stop(this.proxy);
    }

    public get_snapshot = (): Snapshot => {
        const state = this.get_state();
        return state.get_snapshot();
    }

    public get_baby_station_list = (): List<BabyStation> => {
        const state = this.get_state();
        return get_baby_station_list(state.get_snapshot());
    }

    private load_snapshot = async (snapshot: Snapshot): Promise<void> => {
        const state = this.get_state();
        state.load_snapshot(this.proxy, snapshot);
    }

    private handle_session_started = (event: SessionStartedEvent): void => {
        const state = this.get_state();
        state.handle_session_started(this.proxy, event);
    }

    private handle_session_ended = (event: SessionEndedEvent): void => {
        const state = this.get_state();
        state.handle_session_ended(this.proxy, event);
    }

    private handle_client_connected = (event: EventConnectedEvent): void => {
        const state = this.get_state();
        state.handle_client_connected(this.proxy, event);
    }

    private handle_client_disconnected = (event: EventDisconnectedEvent): void => {
        const state = this.get_state();
        state.handle_client_disconnected(this.proxy, event);
    }

    private handle_server_started = (event: ServerStartedEvent): void => {
        const state = this.get_state();
        state.handle_server_started(this.proxy, event);
    }
}

export default BabyStationListService;

interface Snapshot {
    cursor: number;
    session_by_id: Map<string, Session>;
    session_id_by_connection_id: Map<string, string>;
    connection_by_id: Map<string, Connection>;
}

const EmptySnapshot: Snapshot = {
    cursor: 0,
    session_by_id: Map(),
    session_id_by_connection_id: Map(),
    connection_by_id: Map(),
}

const get_baby_station_list = (snapshot: Snapshot): List<BabyStation> => {
    return snapshot.connection_by_id.map((connection): Optional<BabyStation> => {
        const sessionID = snapshot.session_id_by_connection_id.get(connection.id);
        if (!sessionID) return null;
        const session = snapshot.session_by_id.get(sessionID);
        if (!session) throw new Error(`Session not found: ${sessionID}`);
        return {
            session,
            connection,
        };
    }).filter((baby_station: Optional<BabyStation>): baby_station is BabyStation => baby_station !== null).toList();
};

interface GetSnapshotOutput {
    cursor: number;
    session_by_id: {
        [key: string]: {
            id: string;
            name: string;
            started_at: string;
            host_connection_id: string;
        }
    }
    session_id_by_connection_id: {
        [key: string]: string;
    }
    connection_by_id: {
        [key: string]: {
            client_id: string;
            id: string;
            request_id: string;
        }
    }
}