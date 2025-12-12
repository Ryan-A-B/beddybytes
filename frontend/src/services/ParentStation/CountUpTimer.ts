import moment from "moment";

interface Proxy {
    set_state(state: TimerState): void;
}

abstract class AbstractState {
    public abstract readonly name: string;
    public abstract get_elapsed_time: () => moment.Duration;
    public abstract start: (proxy: Proxy) => void;
    public abstract pause: (proxy: Proxy) => void;
    public abstract reset: (proxy: Proxy) => void;
}

class NotRunning extends AbstractState {
    public readonly name = 'NotRunning';

    public get_elapsed_time = (): moment.Duration => {
        return moment.duration(0);
    }

    public start = (proxy: Proxy) => {
        proxy.set_state(new Running());
    }

    public pause = (proxy: Proxy) => { }

    public reset = (proxy: Proxy) => { }
}

class Running extends AbstractState {
    public readonly name = 'Running';
    public readonly previously_elapsed_time = moment.duration(0);
    public readonly started_at = moment();

    constructor(previously_elapsed_time: moment.Duration = moment.duration(0)) {
        super();
        this.previously_elapsed_time = previously_elapsed_time;
    }

    public get_elapsed_time = (): moment.Duration => {
        const now = moment();
        return moment.duration(now.diff(this.started_at)).add(this.previously_elapsed_time);
    }

    public start = (proxy: Proxy) => { }

    public pause = (proxy: Proxy) => {
        proxy.set_state(new Paused(this.get_elapsed_time()));
    }

    public reset = (proxy: Proxy) => {
        proxy.set_state(new NotRunning());
    }
}

class Paused extends AbstractState {
    public readonly name = 'Paused';
    public readonly elapsed_time: moment.Duration;

    constructor(elapsed_time: moment.Duration) {
        super();
        this.elapsed_time = elapsed_time;
    }   

    public get_elapsed_time = (): moment.Duration => {
        return this.elapsed_time;
    }

    public start = (proxy: Proxy) => {
        proxy.set_state(new Running(this.elapsed_time));
    }

    public pause = (proxy: Proxy) => { }

    public reset = (proxy: Proxy) => {
        proxy.set_state(new NotRunning());
    }
}

type TimerState = NotRunning | Running | Paused;

export const EventTypeStateChanged = 'state-changed';

class CountUpTimer extends EventTarget {
    private state: TimerState;
    private proxy: Proxy;

    constructor() {
        super();
        this.state = new NotRunning();
        this.proxy = {
            set_state: this.set_state,
        }
    }

    private set_state = (state: TimerState) => {
        this.state = state;
        this.dispatchEvent(new Event(EventTypeStateChanged));
    }

    public get_state = (): TimerState['name'] => {
        return this.state.name;
    }

    public get_elapsed_time = (): moment.Duration => {
        return this.state.get_elapsed_time();
    }

    public start = () => {
        this.state.start(this.proxy);
    }

    public pause = () => {
        this.state.pause(this.proxy);
    }

    public reset = () => {
        this.state.reset(this.proxy);
    }
}

export default CountUpTimer;