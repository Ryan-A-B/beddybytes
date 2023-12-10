

class QueueingDecorator extends EventTarget implements SignalService {
    public readonly connection_id: string;
    private decorated: SignalService;

    constructor(decorated: SignalService) {
        super();
        this.connection_id = decorated.connection_id;
        this.decorated = decorated;
        this.decorated.addEventListener("signal", this.dispatchEvent);
    }

    public get_state = (): SignalState => {
        return this.decorated.get_state();
    }

    public start = () => {
        this.decorated.start();
    }

    public send_signal(input: SendSignalInput): void {
        const state = this.decorated.get_state();
        switch (state.state) {
            case 'connecting':
                // add to queue
                return
            case 'connected':
                this.decorated.send_signal(input);
                return;
            case 'reconnecting':
                // add to queue
                return
            default:
                throw new Error(`invalid state: ${state.state}`);
        }
    }

    public stop = () => {
        this.decorated.stop();
    }
}

export default QueueingDecorator;
