namespace eventstore {
    export interface Event {
        id: string,
        type: string,
        logical_clock: number,
        unix_timestamp: number,
        data: any
    }

    export interface GetEventIteratorInput {
        from_cursor: number,
    }

    export interface EventStore {
        put(event: Event): Promise<void>,
        get_events(input: GetEventIteratorInput): AsyncEventIterator,
    }

    export type AsyncEventIterator = AsyncIterableIterator<Event>
}

export default eventstore;
