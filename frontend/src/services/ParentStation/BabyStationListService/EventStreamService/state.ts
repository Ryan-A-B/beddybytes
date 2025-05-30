import { SetStateFunction } from "../../../Service";
import LoggingService, { Severity } from "../../../LoggingService";
import sleep from "../../../../utils/sleep";
import BeddyBytesEvent from "./event";

const MaxReconnectDelay = 10 * 1000;
const InitialReconnectDelay = 1000;

abstract class AbstractState {
    public abstract name: string;
    public abstract start: (service: IEventStreamService, from_cursor: number) => Promise<void>;
    public abstract stop: (service: IEventStreamService) => void;
    public abstract handle_open: (service: IEventStreamService, event: Event) => void;
    public abstract handle_error: (service: IEventStreamService, error: Event) => Promise<void>;
    public abstract handle_message: (service: IEventStreamService, message: MessageEvent<string>) => void;
}

export interface IEventStreamService {
    logging_service: LoggingService;
    set_state: SetStateFunction<EventStreamState>;
    set_cursor: (cursor: number) => void;
    remove_event_listeners: (event_source: EventSource) => void
    connect: () => Promise<EventSource>;
    dispatchEvent: (event: Event) => void;
}

export class NotRunning extends AbstractState {
    public readonly name = 'not_running';

    public start = async (service: IEventStreamService, from_cursor: number): Promise<void> => {
        service.set_cursor(from_cursor);
        const event_source = await service.connect();
        service.set_state(new Connecting(event_source, InitialReconnectDelay));
    }

    public stop = (service: IEventStreamService): void => {
        throw new Error('Cannot stop when not running');
    }

    public handle_open = (service: IEventStreamService, event: Event): void => {
        const event_source = event.target as EventSource;
        event_source.close();
        service.remove_event_listeners(event_source);
    }

    public handle_error = async (service: IEventStreamService, error: Event): Promise<void> => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: `Received error while not running: ${error}`,
        });
    }

    public handle_message = (service: IEventStreamService, message: MessageEvent<string>): void => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: `Received message while not running: ${message.data}`,
        });
    }
}

abstract class Running extends AbstractState {
    protected readonly event_source: EventSource;

    constructor(event_source: EventSource) {
        super();
        this.event_source = event_source;
    }

    public start = async (service: IEventStreamService): Promise<void> => {
        throw new Error('Cannot run when already running');
    }

    public stop = (service: IEventStreamService): void => {
        this.event_source.close();
        service.set_state(new NotRunning());
        service.remove_event_listeners(this.event_source);
    }
}

class Connecting extends Running {
    public readonly name = 'connecting';
    private readonly reconnect_delay: number;

    constructor(event_source: EventSource, reconnect_delay: number) {
        super(event_source);
        this.reconnect_delay = reconnect_delay;
    }

    public handle_open = (service: IEventStreamService, event: Event): void => {
        service.set_state(new Connected(this.event_source));
    }

    public handle_error = async (service: IEventStreamService, error: Event): Promise<void> => {
        service.remove_event_listeners(this.event_source);
        this.event_source.close();
        const next_reconnect_delay = Math.min(this.reconnect_delay * 2, MaxReconnectDelay);
        const event_source = await this.reconnect(service);
        service.set_state(new Connecting(event_source, next_reconnect_delay));
    }

    public handle_message = async (service: IEventStreamService, message: MessageEvent<string>): Promise<void> => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: `Received message while connecting: ${message.data}`,
        })
    }

    private reconnect = async (service: IEventStreamService): Promise<EventSource> => {
        await sleep(this.reconnect_delay);
        return service.connect();
    }
}

class Connected extends Running {
    public readonly name = 'connected';

    public handle_open = (service: IEventStreamService, event: Event): void => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: `Received open event while connected: ${event}`,
        });
    }

    public handle_error = async (service: IEventStreamService, error: Event): Promise<void> => {
        service.remove_event_listeners(this.event_source);
        this.event_source.close();
        const event_source = await service.connect();
        service.set_state(new Connecting(event_source, InitialReconnectDelay));
    }

    public handle_message = (service: IEventStreamService, message: MessageEvent<string>): void => {
        const event = new BeddyBytesEvent(JSON.parse(message.data));
        // service.logging_service.log({
        //     severity: Severity.Debug,
        //     message: `Received event: ${JSON.stringify(event)}`,
        // });
        service.set_cursor(event.logical_clock);
        service.dispatchEvent(event);
    }
}

type EventStreamState = NotRunning | Connecting | Connected;

export default EventStreamState;