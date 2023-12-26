import { EventTypeSignalStateChange, SendSignalInput, SignalService, SignalState } from "./types";

class MockSignalService extends EventTarget implements SignalService {
    private state: SignalState = { state: 'not_connected' }
    readonly connection_id = 'mock_connection_id';

    start(): void {
        console.log('start')
    }

    get_state(): SignalState {
        return this.state;
    }

    set_state(state: SignalState): void {
        this.state = state;
        this.dispatchEvent(new Event(EventTypeSignalStateChange));
    }

    send_signal(input: SendSignalInput): void {
        console.log('send_signal', input)
    }

    stop(): void {
        console.log('stop')
    }
}

export default MockSignalService;
