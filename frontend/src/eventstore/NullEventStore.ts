import eventstore from ".";

class NullEventStore implements eventstore.EventStore {
    async put(event: eventstore.Event): Promise<void> { }

    async *get_events(input: eventstore.GetEventIteratorInput): eventstore.AsyncEventIterator { }

    async get_last_event(): Promise<eventstore.Event | null> {
        return null;
    }
}

export default NullEventStore;
