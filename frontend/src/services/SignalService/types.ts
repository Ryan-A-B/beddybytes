export const EventTypeSignalStateChange = 'signal_state_change';

export interface SignalStateNotConnected {
    state: 'not_connected';
}

export interface SignalStateConnecting {
    state: 'connecting';
}

export interface SignalStateConnected {
    state: 'connected';
}

export interface SignalStateReconnecting {
    state: 'reconnecting';
}

export interface SignalStateDisconnecting {
    state: 'disconnecting';
}

export type SignalState =
    SignalStateNotConnected |
    SignalStateConnecting |
    SignalStateConnected |
    SignalStateReconnecting |
    SignalStateDisconnecting;

export interface SendSignalInput {
    to_connection_id: string;
    data: any;
}

export interface SignalService extends EventTarget {
    readonly connection_id: string;
    start(): void;
    get_state(): SignalState;
    send_signal(input: SendSignalInput): void;
    stop(): void;
}
