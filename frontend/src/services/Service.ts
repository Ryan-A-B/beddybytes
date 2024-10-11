export const EventTypeStateChanged = 'state_changed';

class Service<T> extends EventTarget {
    private state: T;

    constructor(initial_state: T) {
        super();
        this.state = initial_state;
    }

    public get_state(): T {
        return this.state;
    }

    protected set_state(state: T): void {
        this.state = state;
        this.dispatchEvent(new Event(EventTypeStateChanged));
    }
}

export default Service;
