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
        this.dispatchEvent(new Event(EventTypeStateChanged));
        this.logging_service.log({
            severity: Severity.Debug,
            message: `${this.name}: state changed from ${this.to_string(previous_state)} to ${this.to_string(state)}`
        })
    }

    protected abstract to_string(state: T): string;
}

export default Service;

export type SetStateFunction<T> = (state: T) => void;