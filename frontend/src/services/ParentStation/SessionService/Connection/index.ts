import Service from "../../../Service";

export enum InitiatedBy {
    Host = 0,
    Client = 1,
}

// connection states
// new: built in
// connecting: built in
// connected: built in
// disconnected: built in, "connection lost, attempting to reconnect"
// failed: 
//   - built in
//   - "connection lost"
//   - user action required?
//   - automatic reconnect with exponential backoff?
//   - reconnect on network change
//   - play sound loop
// closed: built in
// unable_to_connect: connecting -> failed

interface ConnectionStateNew {
    state: 'new';
}

interface ConnectionStateConnecting {
    state: 'connecting';
}

interface ConnectionStateConnected {
    state: 'connected';
}

interface ConnectionStateDisconnected {
    state: 'disconnected';
}

interface ConnectionStateFailed {
    state: 'failed';
}

interface ConnectionStateClosed {
    state: 'closed';
}

interface ConnectionStateUnableToConnect {
    state: 'unable_to_connect';
}

export type ConnectionState =
    ConnectionStateNew |
    ConnectionStateConnecting |
    ConnectionStateConnected |
    ConnectionStateDisconnected |
    ConnectionStateFailed |
    ConnectionStateClosed |
    ConnectionStateUnableToConnect;

interface Connection extends Service<ConnectionState> {
    reconnect(): void;
    close(initiatedBy: InitiatedBy): void;
}

export default Connection;