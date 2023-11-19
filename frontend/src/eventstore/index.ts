namespace eventstore {
    export const MomentFormatUnixTimestamp = 'X';
    export const MomentFormatRFC3339 = 'YYYY-MM-DDTHH:mm:ssZ';

    export interface Event<T = unknown> {
        id: string,
        type: string,
        logical_clock: number,
        unix_timestamp: number,
        data: T
    }

    export interface GetEventIteratorInput {
        from_cursor: number,
    }

    export interface EventStore {
        put(event: Event): Promise<void>,
        get_events(input: GetEventIteratorInput): AsyncEventIterator,
        get_last_event(): Promise<Event | null>,
    }

    export type AsyncEventIterator = AsyncIterableIterator<Event>
}

export default eventstore;
