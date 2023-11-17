namespace eventstore {
    export interface Event<T> {
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
        put(event: Event<unknown>): Promise<void>,
        get_events(input: GetEventIteratorInput): AsyncEventIterator,
    }

    export type AsyncEventIterator = AsyncIterableIterator<Event<unknown>>
}

export default eventstore;
