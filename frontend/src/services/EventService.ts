import { EventTypeRemoteEvent } from "../Connection/WebSocketConnection";
import ConnectionService, { EventTypeConnectionStatusChanged } from "./ConnectionService";
import eventstore from "../eventstore";

import IndexedDBEventStore from "../eventstore/IndexedDBEventStore";
import FollowingDecorator from "../eventstore/FollowingDecorator";

export const EventTypeEventServiceStatusChanged = 'event_service_status_changed';

interface EventServiceStatusLoading {
    status: 'loading';
}

interface EventServiceStatusReady {
    status: 'ready';
    event_store: eventstore.EventStore;
}

export type EventServiceStatus = EventServiceStatusLoading | EventServiceStatusReady;

interface NewEventServiceInput {
    connection_service: ConnectionService;
}

class EventService extends EventTarget {
    // TODO this service should make it's own request to the server to get the latest events, there is a possibility events could be missed with this implementation
    private connection_service: ConnectionService;
    private status: EventServiceStatus = { status: 'loading' };
    private listening: boolean = false; // TODO this could be the source of a bug in the future...

    constructor(input: NewEventServiceInput) {
        super();
        this.connection_service = input.connection_service;
        this.create_event_store();
    }

    public get_status = (): EventServiceStatus => {
        return this.status;
    }

    private start_listening_for_remote_events_if_not_already = () => {
        if (this.listening)
            return;
        const connection_status = this.connection_service.get_status();
        if (connection_status.status === 'not_connected')
            return;
        const connection = connection_status.connection;
        connection.addEventListener(EventTypeRemoteEvent, this.handle_remote_event);
        this.listening = true;
    }

    private handle_remote_event = (event: Event) => {
        if (this.status.status !== 'ready')
            throw new Error(`Expected status to be ready, but was ${this.status.status}`);
        const custom_event = event as CustomEvent<eventstore.Event<unknown>>;
        const remote_event = custom_event.detail;
        const event_store = this.status.event_store;
        event_store.put(remote_event);
    }

    private create_event_store = async (): Promise<void> => {
        const DatabaseName = 'event_store';
        const event_store_indexeddb = await IndexedDBEventStore.create(DatabaseName);
        const event_store = new FollowingDecorator(event_store_indexeddb);
        this.status = {
            status: 'ready',
            event_store,
        };
        this.dispatchEvent(new Event(EventTypeEventServiceStatusChanged));
        this.connection_service.addEventListener(EventTypeConnectionStatusChanged, this.start_listening_for_remote_events_if_not_already);
        this.start_listening_for_remote_events_if_not_already();
    }
}

export default EventService;
