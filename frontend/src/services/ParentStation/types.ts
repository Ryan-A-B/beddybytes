export interface BabyStation {
    client_id: string;
    session: Session;
}

export interface Session {
    id: string;
    name: string;
    started_at: number;
}
