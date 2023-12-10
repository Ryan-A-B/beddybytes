
const EventTypeSignalStateChange = 'signal_state_change';

interface SignalStateNotConnected {
    state: 'not_connected';
}

interface SignalStateConnecting {
    state: 'connecting';
}

interface SignalStateConnected {
    state: 'connected';
}

interface SignalStateReconnecting {
    state: 'reconnecting';
}

interface SignalStateDisconnecting {
    state: 'disconnecting';
}

type SignalState =
    SignalStateNotConnected |
    SignalStateConnecting |
    SignalStateConnected |
    SignalStateReconnecting |
    SignalStateDisconnecting;

interface SendSignalInput {
    to_connection_id: string;
    data: any;
}

interface SignalService extends EventTarget {
    readonly connection_id: string;
    start(): void;
    get_state(): SignalState;
    send_signal(input: SendSignalInput): void;
    stop(): void;
}
