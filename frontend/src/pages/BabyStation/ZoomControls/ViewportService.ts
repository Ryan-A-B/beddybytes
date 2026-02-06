import { PanEvent, Vec2, ZoomEvent } from "./GestureHandler";

class ViewportService extends EventTarget {
    private max_width: number;
    private max_height: number;
    public readonly max_scale: number;
    private last_zoom_identifier: string = "";
    private last_scale: number = 1.0;
    private scale: number = 1.0;
    private offsetX: number = 0;
    private offsetY: number = 0;

    private width: number;
    private height: number;
    private maxOffsetX: number = 0;
    private maxOffsetY: number = 0;

    constructor(max_width: number, max_height: number, max_scale: number = 3.0) {
        super();
        this.max_width = max_width;
        this.max_height = max_height;
        this.max_scale = max_scale;

        this.width = max_width;
        this.height = max_height;
    }

    get_width(): number { return this.width }
    get_height(): number { return this.height }
    get_offsetX(): number { return this.offsetX }
    get_offsetY(): number { return this.offsetY }

    public handle_pan = (event: PanEvent): void => {
        this.offsetX += event.dx;
        this.offsetY += event.dy;

        this.clamp_offset();

        this.dispatch_viewport_changed_event();
    }

    public handle_zoom = (event: ZoomEvent): void => {
        if (this.last_zoom_identifier !== event.identifier) {
            this.last_zoom_identifier = event.identifier;
            this.last_scale = this.scale;
        }
        const scale = this.last_scale * event.scale;
        this.set_scale(scale);
    }

    public set_scale = (scale: number): void => {
        this.scale = scale;
        if (this.scale <= 1.0) {
            this.reset(this.max_width, this.max_height);
            return;
        }
        if (this.scale > this.max_scale) {
            this.scale = this.max_scale;
        }

        const current_centerX = this.offsetX + this.width / 2;
        const current_centerY = this.offsetY + this.height / 2;

        this.width = this.max_width / this.scale;
        this.height = this.max_height / this.scale;
        this.maxOffsetX = this.max_width - this.width;
        this.maxOffsetY = this.max_height - this.height;

        this.offsetX = current_centerX - this.width / 2;
        this.offsetY = current_centerY - this.height / 2;

        this.clamp_offset();

        this.dispatch_viewport_changed_event();
    }

    private clamp_offset = (): void => {
        if (this.offsetX < 0) this.offsetX = 0;
        if (this.offsetY < 0) this.offsetY = 0;
        if (this.offsetX > this.maxOffsetX) this.offsetX = this.maxOffsetX;
        if (this.offsetY > this.maxOffsetY) this.offsetY = this.maxOffsetY;
    }

    public reset = (max_width: number, max_height: number): void => {
        const no_change = this.max_width === max_width && this.max_height === max_height;
        if (no_change) return;

        this.max_width = max_width;
        this.max_height = max_height;
        this.scale = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.width = max_width;
        this.height = max_height;
        this.maxOffsetX = 0;
        this.maxOffsetY = 0;

        this.dispatch_viewport_changed_event();
    };

    public get_viewport = (): Viewport => {
        return {
            width: this.width,
            height: this.height,
            offsetX: this.offsetX,
            offsetY: this.offsetY
        };
    }

    private dispatch_viewport_changed_event = (): void => {
        this.dispatchEvent(new ViewportChangedEvent(this.get_viewport()));
    }
}

interface ViewportService extends EventTarget {
    addEventListener(type: typeof EventTypeViewportChanged, listener: (this: EventSource, ev: ViewportChangedEvent) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

    removeEventListener(type: typeof EventTypeViewportChanged, listener: (this: EventSource, ev: ViewportChangedEvent) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

export default ViewportService;

export const EventTypeViewportChanged = "viewport_changed";

export type Viewport = {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
};

export class ViewportChangedEvent extends Event {
    public readonly viewport: Viewport;

    constructor(viewport: Viewport) {
        super(EventTypeViewportChanged);
        this.viewport = viewport;
    }
}