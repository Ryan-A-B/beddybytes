import { List } from "immutable";
import eventstore from ".";

class FollowingDecorator implements eventstore.EventStore {
    private decorated: eventstore.EventStore;
    private followers: List<Follower> = List();

    constructor(decorated: eventstore.EventStore) {
        this.decorated = decorated;
    }

    async put(event: eventstore.Event<unknown>): Promise<void> {
        await this.decorated.put(event);
        this.followers.forEach(follower => follower.push(event));
    }

    async *get_events(input: eventstore.GetEventIteratorInput): eventstore.AsyncEventIterator {
        const follower = new Follower();
        this.followers = this.followers.push(follower);
        for await (const event of this.decorated.get_events(input)) {
            yield event;
        }
        for await (const event of follower.get_events(input)) {
            yield event;
        }
    }
}

class Follower {
    private queue: eventstore.Event<unknown>[] = [];
    private promise: Promise<void>;
    private resolve: () => void = () => {
        throw new Error("resolve called before promise was created");
    };

    constructor() {
        this.promise = new Promise(resolve => {
            this.resolve = resolve
        });
    }

    push(event: eventstore.Event<unknown>) {
        this.queue.push(event);
        this.resolve();
        this.promise = new Promise(resolve => {
            this.resolve = resolve
        });
    }

    async *get_events(input: eventstore.GetEventIteratorInput): eventstore.AsyncEventIterator {
        while (true) {
            const event = this.queue.shift();
            if (event !== undefined) {
                yield event;
                continue;
            }
            await this.promise;
        }
    }
}

export default FollowingDecorator;
