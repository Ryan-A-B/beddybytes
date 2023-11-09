import { v4 as uuid } from 'uuid';
import eventstore from './eventstore';
import FollowingDecorator from './FollowingDecorator';
import NullEventStore from './NullEventStore';

const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min) + min);
}

describe('FollowingDecorator', () => {
    describe('decorating NullEventStore', () => {
        it('should follow one event', async () => {
            const eventstore = new FollowingDecorator(new NullEventStore());
            const iterator = eventstore.get_events({ from_cursor: 0 });
            const event: eventstore.Event = {
                id: uuid(),
                type: uuid(),
                logical_clock: 1,
                unix_timestamp: Date.now(),
                data: {
                    test: uuid(),
                },
            }
            eventstore.put(event);
            const result = await iterator.next();
            expect(result.done).toBe(false);
            expect(result.value).toEqual(event);
        });
        it('should follow two events', async () => {
            const eventstore = new FollowingDecorator(new NullEventStore());
            const iterator = eventstore.get_events({ from_cursor: 0 });
            const events: eventstore.Event[] = [
                {
                    id: uuid(),
                    type: uuid(),
                    logical_clock: 1,
                    unix_timestamp: Date.now(),
                    data: { test: uuid() },
                },
                {
                    id: uuid(),
                    type: uuid(),
                    logical_clock: 2,
                    unix_timestamp: Date.now(),
                    data: { test: uuid() },
                },
            ]
            events.forEach(event => eventstore.put(event));
            {
                const result = await iterator.next();
                expect(result.done).toBe(false);
                expect(result.value).toEqual(events[0]);
            }
            {
                const result = await iterator.next();
                expect(result.done).toBe(false);
                expect(result.value).toEqual(events[1]);
            }
        });
        it('should follow n events', async () => {
            const eventstore = new FollowingDecorator(new NullEventStore());
            const iterator = eventstore.get_events({ from_cursor: 0 });
            const n_iterations = getRandomInt(1, 10);
            for (let i = 0; i < n_iterations; i++) {
                const events: eventstore.Event[] = []
                const n_events = getRandomInt(1, 30);
                for (let j = 0; j < n_events; j++) {
                    events.push({
                        id: uuid(),
                        type: uuid(),
                        logical_clock: j + 1,
                        unix_timestamp: Date.now(),
                        data: { test: uuid() },
                    });
                    eventstore.put(events[j]);
                }
                for (let j = 0; j < n_events; j++) {
                    const result = await iterator.next();
                    expect(result.done).toBe(false);
                    expect(result.value).toEqual(events[j]);
                }
            }
        });
    });
});
