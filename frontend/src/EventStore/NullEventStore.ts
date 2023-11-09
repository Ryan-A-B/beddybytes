import eventstore from "./eventstore";

class NullEventStore implements eventstore.EventStore {
    async put(event: eventstore.Event): Promise<void> { }

    async *get_events(input: eventstore.GetEventIteratorInput): eventstore.AsyncEventIterator { }
}

export default NullEventStore;
