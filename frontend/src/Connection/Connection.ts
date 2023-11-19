

export interface Signal {
    to_connection_id: string;
    data: any;
}

export interface Signaler extends EventTarget {
    sendSignal: (signal: Signal) => void;
}

interface Connection extends Signaler, EventTarget {
    readonly id: string;
}

export default Connection;

export const EventTypeConnectionLost = 'connection_lost';
export const EventTypeClientDisconnected = 'client.disconnected';

export interface ClientDisconnectedEventDetail {
    client_id: string;
    connection_id: string;
    web_socket_close_code: number;
}
