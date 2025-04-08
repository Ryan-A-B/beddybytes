export interface BabyStation {
    session: Session;
    connection: Connection
}

export interface Session {
    id: string;
    name: string;
    started_at: moment.Moment;
    host_connection_id: string;
}

export interface Connection {
    client_id: string;
    id: string;
    request_id: string;
}