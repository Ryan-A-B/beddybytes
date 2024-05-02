import { List } from "immutable";
import { EventTypeSignalStateChange } from "./WebSocketSignalService";

class QueueingDecorator extends EventTarget implements SignalService {
    public readonly connection_id: string;
    private decorated: SignalService;
    private queue: List<SendSignalInput> = List();
    private state: SignalState;

    constructor(decorated: SignalService) {
        super();
        this.connection_id = decorated.connection_id;
        this.decorated = decorated;
        this.state = decorated.get_state();
        this.decorated.addEventListener(EventTypeSignalStateChange, this.handle_signal_state_change);
        this.decorated.addEventListener("signal", this.handle_signal_event);
    }

    public get_state = (): SignalState => {
        return this.state;
    }

    private handle_signal_state_change = () => {
        this.state = this.decorated.get_state();
        if (this.state.state === 'connected')
            this.flush_queue();
        this.dispatchEvent(new Event(EventTypeSignalStateChange));
    }

    private handle_signal_event = (event: Event) => {
        if (!(event instanceof CustomEvent)) throw new Error("invalid event");
        const detail = event.detail;
        this.dispatchEvent(new CustomEvent("signal", { detail }));
    }

    public start = () => {
        this.decorated.start();
    }

    public send_signal(input: SendSignalInput): void {
        const state = this.decorated.get_state();
        switch (state.state) {
            case 'connecting':
                this.queue = this.queue.push(input);
                return
            case 'connected':
                this.decorated.send_signal(input);
                return;
            case 'reconnecting':
                this.queue = this.queue.push(input);
                return
            default:
                throw new Error(`invalid state: ${state.state}`);
        }
    }

    private flush_queue = () => {
        while (this.queue.size > 0) {
            this.decorated.send_signal(this.queue.first());
            this.queue = this.queue.shift();
        }
    }

    public stop = () => {
        this.decorated.stop();
    }
}

export default QueueingDecorator;
