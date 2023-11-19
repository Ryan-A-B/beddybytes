import eventstore from "../eventstore";

import IndexedDBEventStore from "../eventstore/IndexedDBEventStore";
import FollowingDecorator from "../eventstore/FollowingDecorator";
import settings from "../settings";
import AuthorizationService from "./AuthorizationService";

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
    authorization_service: AuthorizationService;
}

class EventService extends EventTarget {
    private authorization_service: AuthorizationService;
    private status: EventServiceStatus = { status: 'loading' };

    constructor(input: NewEventServiceInput) {
        super();
        this.authorization_service = input.authorization_service;
        this.create_event_store();
    }

    public get_status = (): EventServiceStatus => {
        return this.status;
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

        // TODO add reconnect logic - EventSource will automatically try to reconnect, but eventually the access token will expire and the from_cursor will change
        // consider using a fetch and managing the EventSource ourselves
        const access_token = await this.authorization_service.get_access_token();
        const query_parameters = new URLSearchParams();
        const last_event = await event_store.get_last_event();
        if (last_event !== null)
            query_parameters.set('from_cursor', last_event.logical_clock.toString());
        query_parameters.set('access_token', access_token);
        const event_source = new EventSource(`https://${settings.API.host}/events?${query_parameters.toString()}`);
        event_source.addEventListener('error', (error: Event) => {
            console.error('EventSource error', error);
        });
        event_source.addEventListener('message', (message: MessageEvent<string>) => {
            const event = JSON.parse(message.data) as eventstore.Event;
            event_store.put(event).catch(console.error);
        });
    }
}

export default EventService;
