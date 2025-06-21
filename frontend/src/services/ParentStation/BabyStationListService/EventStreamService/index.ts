import Service, { ServiceStateChangedEvent } from "../../../Service";
import LoggingService from "../../../LoggingService";
import settings from "../../../../settings";
import EventStreamState, { IEventStreamService, NotRunning } from "./state";
import { EventConnectedEvent, EventDisconnectedEvent, ServerStartedEvent, SessionEndedEvent, SessionStartedEvent } from "./event";

interface NewEventStreamServiceInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

class EventStreamService extends Service<EventStreamState> {
    public readonly name: string = 'EventStreamService';
    private readonly authorization_service: AuthorizationService;
    private readonly proxy: IEventStreamService;
    private cursor: number = 0;

    constructor(input: NewEventStreamServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: new NotRunning(),
        });
        this.authorization_service = input.authorization_service;
        this.proxy = {
            logging_service: input.logging_service,
            set_state: this.set_state,
            set_cursor: this.set_cursor,
            remove_event_listeners: this.remove_event_listeners,
            connect: this.connect,
            dispatchEvent: this.dispatchEvent.bind(this),
        };
    }

    protected to_string = (state: EventStreamState): string => {
        return state.name;
    }

    public start = (from_cursor: number): void => {
        const state = this.get_state();
        state.start(this.proxy, from_cursor);
    }

    public stop = (): void => {
        const state = this.get_state();
        state.stop(this.proxy);
    }

    private set_cursor = (cursor: number): void => {
        this.cursor = cursor;
    }

    private connect = async (): Promise<EventSource> => {
        const access_token = await this.authorization_service.get_access_token();
        const query_parameters = new URLSearchParams();
        query_parameters.set('from_cursor', this.cursor.toString());
        query_parameters.set('access_token', access_token);
        const event_source = new EventSource(`https://${settings.API.host}/events?${query_parameters.toString()}`);
        event_source.addEventListener('open', this.handle_open);
        event_source.addEventListener('error', this.handle_error);
        event_source.addEventListener('message', this.handle_message);
        return event_source;
    }

    private handle_open = (event: Event): void => {
        // TODO open doesn't fire until the first message is received
        const state = this.get_state();
        state.handle_open(this.proxy, event);
    }

    private handle_error = (error: Event): void => {
        const state = this.get_state();
        state.handle_error(this.proxy, error);
    }

    private handle_message = (message_event: MessageEvent<string>): void => {
        const state = this.get_state();
        state.handle_message(this.proxy, message_event);
    }

    private remove_event_listeners = (event_source: EventSource): void => {
        event_source.removeEventListener('open', this.handle_open);
        event_source.removeEventListener('error', this.handle_error);
        event_source.removeEventListener('message', this.handle_message);
    }
}

export default EventStreamService;

interface EventStreamService extends EventTarget {
    addEventListener<K extends keyof EventMap>(type: K, listener: (this: EventSource, ev: EventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: 'state_changed', listener: (this: EventSource, ev: ServiceStateChangedEvent<EventStreamState>) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

    removeEventListener<K extends keyof EventMap>(type: K, listener: (this: EventSource, ev: EventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: 'state_changed', listener: (this: EventSource, ev: ServiceStateChangedEvent<EventStreamState>) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface EventMap {
    "session.started": SessionStartedEvent;
    "session.ended": SessionEndedEvent;
    "client.connected": EventConnectedEvent;
    "client.disconnected": EventDisconnectedEvent;
    "server.started": ServerStartedEvent;
}