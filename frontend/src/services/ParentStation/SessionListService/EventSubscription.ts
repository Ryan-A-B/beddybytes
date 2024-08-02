import settings from '../../../settings';
import eventstore from "../../../eventstore";
import sleep from '../../../utils/sleep';
import LoggingService, { Severity } from '../../LoggingService';

interface NewEventSubscriptionInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    from_cursor: number;
}

class EventSubscription extends EventTarget {
    private static MaxReconnectDelay = 5 * 60 * 1000;
    private static InitialReconnectDelay = 1000;
    private logging_service: LoggingService;
    private authorization_service: AuthorizationService;
    private from_cursor: number;
    private reconnect_delay = EventSubscription.InitialReconnectDelay;

    constructor(input: NewEventSubscriptionInput) {
        super();
        this.logging_service = input.logging_service;
        this.authorization_service = input.authorization_service;
        this.from_cursor = input.from_cursor;
        this.connect();
    }

    private connect = async (): Promise<void> => {
        const access_token = await this.authorization_service.get_access_token();
        const query_parameters = new URLSearchParams();
        query_parameters.set('from_cursor', this.from_cursor.toString());
        query_parameters.set('access_token', access_token);
        const event_source = new EventSource(`https://${settings.API.host}/events?${query_parameters.toString()}`);
        event_source.addEventListener('open', this.handle_open);
        event_source.addEventListener('error', this.handle_error);
        event_source.addEventListener('message', this.handle_message);
    }

    private handle_open = (): void => {
        this.logging_service.log({
            severity: Severity.Debug,
            message: `Connected to event source`,
        });
        this.reconnect_delay = EventSubscription.InitialReconnectDelay;
    }

    private handle_message = async (message: MessageEvent<string>): Promise<void> => {
        const event = JSON.parse(message.data) as eventstore.Event;
        this.from_cursor = event.logical_clock;
        this.dispatchEvent(new CustomEvent<eventstore.Event>('event', { detail: event }));
    }

    private handle_error = (error: Event): void => {
        const event_source = error.target as EventSource;
        event_source.close()
        this.logging_service.log({
            severity: Severity.Error,
            message: `Failed to connect to event source, reconnecting in ${this.reconnect_delay}ms`,
        });
        this.reconnect();
    }

    private reconnect = async (): Promise<void> => {
        await sleep(this.reconnect_delay)
        this.reconnect_delay = Math.min(this.reconnect_delay * 2, EventSubscription.MaxReconnectDelay);
        this.connect();
    }
}

export default EventSubscription;