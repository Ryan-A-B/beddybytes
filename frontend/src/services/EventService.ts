import eventstore from "../eventstore";

import IndexedDBEventStore from "../eventstore/IndexedDBEventStore";
import FollowingDecorator from "../eventstore/FollowingDecorator";
import settings from "../settings";
import LoggingService from "./LoggingService";
import { Severity } from "./LoggingService/models";
import AuthorizationService from "./AuthorizationService";
import sleep from "../utils/sleep";

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
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

class EventService extends EventTarget {
    private static MaxReconnectDelay = 5 * 60 * 1000;
    private static InitialReconnectDelay = 1000;
    private logging_service: LoggingService;
    private authorization_service: AuthorizationService;
    private status: EventServiceStatus = { status: 'loading' };
    private reconnect_delay = EventService.InitialReconnectDelay;

    constructor(input: NewEventServiceInput) {
        super();
        this.logging_service = input.logging_service;
        this.authorization_service = input.authorization_service;
        this.create_event_store();
    }

    public get_status = (): EventServiceStatus => {
        return this.status;
    }

    private set_status = (status: EventServiceStatus) => {
        this.logging_service.log({
            severity: Severity.Debug,
            message: `Event service status changed from ${this.status.status} to ${status.status}`,
        });
        this.status = status;
        this.dispatchEvent(new Event(EventTypeEventServiceStatusChanged));
    }

    private create_event_store = async (): Promise<void> => {
        const DatabaseName = 'event_store';
        const event_store_indexeddb = await IndexedDBEventStore.create(DatabaseName);
        const event_store = new FollowingDecorator(event_store_indexeddb);
        this.set_status({
            status: 'ready',
            event_store,
        });
        this.connect(event_store);
    }

    private connect = async (event_store: eventstore.EventStore): Promise<void> => {
        const access_token = await this.authorization_service.get_access_token();
        const query_parameters = new URLSearchParams();
        const last_event = await event_store.get_last_event();
        if (last_event !== null)
            query_parameters.set('from_cursor', last_event.logical_clock.toString());
        query_parameters.set('access_token', access_token);
        const event_source = new EventSource(`https://${settings.API.host}/events?${query_parameters.toString()}`);
        event_source.addEventListener('open', this.handle_open);
        event_source.addEventListener('error', this.handle_error(event_store));
        event_source.addEventListener('message', this.handle_message(event_store));
    }

    private handle_open = (): void => {
        this.logging_service.log({
            severity: Severity.Informational,
            message: `Connected to event source`,
        });
        this.reconnect_delay = EventService.InitialReconnectDelay;
    }

    private handle_message = (event_store: eventstore.EventStore) => async (message: MessageEvent<string>): Promise<void> => {
        const event = JSON.parse(message.data) as eventstore.Event;
        await event_store.put(event);
    }

    private handle_error = (event_store: eventstore.EventStore) => (error: Event): void => {
        const event_source = error.target as EventSource;
        event_source.close()

        this.logging_service.log({
            severity: Severity.Error,
            message: `Failed to connect to event source, reconnecting in ${this.reconnect_delay}ms`,
        });
        this.reconnect(event_store);
    }

    private reconnect = async (event_store: eventstore.EventStore): Promise<void> => {
        await sleep(this.reconnect_delay)
        this.reconnect_delay = Math.min(this.reconnect_delay * 2, EventService.MaxReconnectDelay);
        this.connect(event_store);
    }
}

export default EventService;
