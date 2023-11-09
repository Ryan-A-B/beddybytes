import { List } from "immutable";
import eventstore from "./eventstore";

class InMemoryEventStore implements eventstore.EventStore {
    private events: List<eventstore.Event> = List();

    async put(event: eventstore.Event): Promise<void> {
        this.events = this.events.push(event);
    }

    async *get_events(input: eventstore.GetEventIteratorInput): eventstore.AsyncEventIterator {
        const index = this.events.findIndex((event) => event.logical_clock > input.from_cursor);
        if (index === -1) return;
        const events = this.events.slice(index);
        for await (const event of events.values()) {
            yield event;
        }
    }
}

export default InMemoryEventStore;
