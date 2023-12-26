interface ConnectionStreamStateNotAvailable {
    state: 'not_available';
}

interface ConnectionStreamStateAvailable {
    state: 'available';
    stream: MediaStream;
}

type ConnectionStreamState = ConnectionStreamStateNotAvailable | ConnectionStreamStateAvailable;

interface ClientConnection extends EventTarget {
    get_connection_stream_state(): ConnectionStreamState;
    reconnect();
    close(initiatedBy: InitiatedBy);
}