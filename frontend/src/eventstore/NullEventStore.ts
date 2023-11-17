import eventstore from ".";

class NullEventStore implements eventstore.EventStore {
    async put(event: eventstore.Event<unknown>): Promise<void> { }

    async *get_events(input: eventstore.GetEventIteratorInput): eventstore.AsyncEventIterator { }
}

export default NullEventStore;
