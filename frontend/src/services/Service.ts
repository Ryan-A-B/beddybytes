import LoggingService, { Severity } from "./LoggingService";

export const EventTypeStateChanged = 'state_changed';

export interface ServiceState {
    toString: () => string;
}

interface NewServiceInput<T> {
    logging_service: LoggingService;
    initial_state: T;
}

abstract class Service<T extends ServiceState> extends EventTarget {
    protected logging_service: LoggingService;
    protected abstract readonly name: string;
    private state: T;

    constructor(input: NewServiceInput<T>) {
        super();
        this.logging_service = input.logging_service;
        this.state = input.initial_state;
    }

    public get_state = (): T => {
        return this.state;
    }

    protected set_state = (state: T): void => {
        const previous_state = this.state;
        this.state = state;
        this.dispatchEvent(new ServiceStateChangedEvent(previous_state, state));
        this.logging_service.log({
            severity: Severity.Debug,
            message: `${this.name}: state changed from ${this.to_string(previous_state)} to ${this.to_string(state)}`
        });
    }

    protected abstract to_string(state: T): string;
}

export default Service;

export type SetStateFunction<T> = (state: T) => void;

export class ServiceStateChangedEvent<T> extends Event {
    public readonly previous_state: T;
    public readonly current_state: T;

    constructor(previous_state: T, current_state: T) {
        super(EventTypeStateChanged);
        this.previous_state = previous_state;
        this.current_state = current_state;
    }
}

interface Service<T> extends EventTarget {
    addEventListener(type: 'state_changed', listener: (this: EventSource, ev: ServiceStateChangedEvent<T>) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

    removeEventListener(type: 'state_changed', listener: (this: EventSource, ev: ServiceStateChangedEvent<T>) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

export const wait_for_state_change = async <T extends ServiceState>(service: Service<T>): Promise<T> => {
    return new Promise((resolve) => {
        const handle = (event: ServiceStateChangedEvent<T>) => {
            resolve(event.current_state);
            service.removeEventListener(EventTypeStateChanged, handle);
        };
        service.addEventListener(EventTypeStateChanged, handle);
    });
}