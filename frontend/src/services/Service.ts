import LoggingService, { Severity } from "./LoggingService";

export const EventTypeStateChanged = 'state_changed';

export interface ServiceState {
    toString: () => string;
}

interface NewServiceInput<T> {
    logging_service: LoggingService;
    to_string: (state: T) => string;
    initial_state: T;
}

class Service<T extends ServiceState> extends EventTarget {
    protected logging_service: LoggingService;
    private to_string: (state: T) => string;
    private state: T;

    constructor(input: NewServiceInput<T>) {
        super();
        this.logging_service = input.logging_service;
        this.to_string = input.to_string;
        this.state = input.initial_state;
    }

    public get_state(): T {
        return this.state;
    }

    protected set_state(state: T): void {
        const previous_state = this.state;
        this.state = state;
        this.dispatchEvent(new Event(EventTypeStateChanged));
        this.logging_service.log({
            severity: Severity.Debug,
            message: `${this.constructor.name}: state changed from ${this.to_string(previous_state)} to ${this.to_string(state)}`
        })
    }
}

export default Service;
