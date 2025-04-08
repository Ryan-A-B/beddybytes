interface NewBeddyBytesEventInput<T extends string, U> {
    type: T
    id: string
    logical_clock: number
    unix_timestamp: number
    data: U
}

class BeddyBytesEvent<T extends string, U> extends Event {
    public readonly id: string;
    public readonly logical_clock: number;
    public readonly unix_timestamp: number;
    public readonly data: U;

    constructor(input: NewBeddyBytesEventInput<T, U>) {
        super(input.type);
        this.id = input.id;
        this.logical_clock = input.logical_clock;
        this.unix_timestamp = input.unix_timestamp;
        this.data = input.data;
    }
}

export default BeddyBytesEvent

interface StartSessionEventData {
    id: string
    name: string
    host_connection_id: string
    started_at: moment.Moment
}

interface EndSessionEventData {
    id: string
}

interface EventConnected {
    client_id: string
    connection_id: string
    request_id: string
}

interface EventDisconnected {
    client_id: string
    connection_id: string
    request_id: string
}

export type SessionStartedEvent = BeddyBytesEvent<'session.started', StartSessionEventData>
export type SessionEndedEvent = BeddyBytesEvent<'session.ended', EndSessionEventData>
export type EventConnectedEvent = BeddyBytesEvent<'client.connected', EventConnected>
export type EventDisconnectedEvent = BeddyBytesEvent<'client.disconnected', EventDisconnected>
export type ServerStartedEvent = BeddyBytesEvent<'server.started', null>