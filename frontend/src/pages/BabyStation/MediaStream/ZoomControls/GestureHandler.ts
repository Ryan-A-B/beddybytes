
interface Proxy {
    set_state(state: State): void;
    dispatchEvent(event: Event): boolean;
}

abstract class AbstractState {
    public abstract name: string;

    handle_touchstart = (proxy: Proxy, event: TouchEvent): void => {
        event.preventDefault();
        if (event.touches.length === 1) {
            proxy.set_state(new Panning(event.touches));
            return;
        }
        if (event.touches.length === 2) {
            proxy.set_state(new Zooming(event.touches));
            return;
        }
        proxy.set_state(new Ready());
    }

    abstract handle_touchmove(proxy: Proxy, event: TouchEvent): void;

    handle_touchend = (proxy: Proxy, event: TouchEvent): void => {
        event.preventDefault();
        if (event.touches.length === 1) {
            proxy.set_state(new Panning(event.touches));
            return;
        }
        if (event.touches.length === 2) {
            proxy.set_state(new Zooming(event.touches));
            return;
        }
        proxy.set_state(new Ready());
    }

    handle_touchcancel = (proxy: Proxy, event: TouchEvent): void => {
        event.preventDefault();
        proxy.set_state(new Ready());
    }
}

class Ready extends AbstractState {
    name = "Ready";

    handle_touchmove = (proxy: Proxy, event: TouchEvent): void => {
        // Stay in Ready state
    }

    handle_touchcancel = (proxy: Proxy, event: TouchEvent): void => {
        // Stay in Ready state
    }
}

class Panning extends AbstractState {
    name = "Panning";
    private readonly previous_touch: Touch;

    constructor(touches: TouchList) {
        if (touches.length !== 1) throw new Error("Panning state requires one touch point");
        super();
        this.previous_touch = touches[0];
    }

    handle_touchmove = (proxy: Proxy, event: TouchEvent): void => {
        event.preventDefault();
        const dx = this.previous_touch.clientX - event.touches[0].clientX;
        const dy = this.previous_touch.clientY - event.touches[0].clientY;
        proxy.dispatchEvent(new PanEvent(dx, dy));
        proxy.set_state(new Panning(event.touches));
    }
}

class Zooming extends AbstractState {
    name = "Zooming";
    private readonly identifier = crypto.randomUUID();
    // TODO touch identifiers?
    private readonly initial_separation: number;
    private readonly midpoint: Vec2;

    constructor(touches: TouchList) {
        super();
        this.initial_separation = calculate_distance(touches[0], touches[1]);
        this.midpoint = calculate_midpoint(touches[0], touches[1]);
    }

    handle_touchmove = (proxy: Proxy, event: TouchEvent): void => {
        event.preventDefault();
        const current_separation = calculate_distance(event.touches[0], event.touches[1]);
        const scale = current_separation / this.initial_separation;
        proxy.dispatchEvent(new ZoomEvent(this.identifier, scale, this.midpoint));
    }
}

type State = Ready | Panning | Zooming;

class GestureHandler extends EventTarget {
    private state: State = new Ready();
    private readonly proxy: Proxy;

    constructor() {
        super();
        this.proxy = {
            set_state: this.set_state,
            dispatchEvent: (event: Event) => this.dispatchEvent(event),
        };
    }

    private set_state = (state: State): void => {
        this.state = state;
    }

    handle_touchstart = (event: TouchEvent): void => {
        this.state.handle_touchstart(this.proxy, event);
    }

    handle_touchmove = (event: TouchEvent): void => {
        this.state.handle_touchmove(this.proxy, event);
    }

    handle_touchend = (event: TouchEvent): void => {
        this.state.handle_touchend(this.proxy, event);
    }

    handle_touchcancel = (event: TouchEvent): void => {
        this.state.handle_touchcancel(this.proxy, event);
    }
}

interface GestureHandler extends EventTarget {
    addEventListener(type: typeof EventTypePan, listener: (this: EventSource, ev: PanEvent) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: typeof EventTypeZoom, listener: (this: EventSource, ev: ZoomEvent) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

    removeEventListener(type: typeof EventTypePan, listener: (this: EventSource, ev: PanEvent) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: typeof EventTypeZoom, listener: (this: EventSource, ev: ZoomEvent) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

export default GestureHandler;

export const EventTypePan = "pan";
export const EventTypeZoom = "zoom";

export class PanEvent extends Event {
    public readonly dx: number;
    public readonly dy: number;

    constructor(dx: number, dy: number) {
        super(EventTypePan);
        this.dx = dx;
        this.dy = dy;
    }
}

export class ZoomEvent extends Event {
    public readonly identifier: string;
    public readonly scale: number;
    public readonly midpoint: Vec2;

    constructor(identifier: string, scale: number, midpoint: Vec2) {
        super(EventTypeZoom);
        this.identifier = identifier;
        this.scale = scale;
        this.midpoint = midpoint;
    }
}

const calculate_distance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

export interface Vec2 {
    x: number;
    y: number;
}

const calculate_midpoint = (touch1: Touch, touch2: Touch): Vec2 => {
    return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
    };
};