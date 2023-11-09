import { v4 as uuid } from 'uuid';
import eventstore from './eventstore';
import InMemoryEventStore from './InMemoryEventStore';

const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min) + min);
}

describe('InMemoryEventStore', () => {
    describe('from_cursor: 0', () => {
        const from_cursor = 0;
        describe('empty', () => {
            const eventstore = new InMemoryEventStore();
            it('should return empty iterator', async () => {
                const iterator = eventstore.get_events({ from_cursor });
                const result = await iterator.next();
                expect(result.done).toBe(true);
            });
        })
        describe('with one event', () => {
            const eventstore = new InMemoryEventStore();
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
            it('should return one event', async () => {
                const iterator = eventstore.get_events({ from_cursor });
                const result = await iterator.next();
                expect(result.done).toBe(false);
                expect(result.value).toEqual(event);
            });
        })
        describe('with two events', () => {
            const eventstore = new InMemoryEventStore();
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
            it('should return two events', async () => {
                const iterator = eventstore.get_events({ from_cursor });
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
        })
        describe('with n events', () => {
            const eventstore = new InMemoryEventStore();
            const n_iterations = getRandomInt(5, 100);
            const events: eventstore.Event[] = []
            for (let i = 0; i < n_iterations; i++) {
                const event: eventstore.Event = {
                    id: uuid(),
                    type: uuid(),
                    logical_clock: i + 1,
                    unix_timestamp: Date.now(),
                    data: { test: uuid() },
                }
                events.push(event);
                eventstore.put(event);
            }
            it('should return n events', async () => {
                const iterator = eventstore.get_events({ from_cursor });
                for (let i = 0; i < n_iterations; i++) {
                    const result = await iterator.next();
                    expect(result.done).toBe(false);
                    expect(result.value).toEqual(events[i]);
                }
            });
        })
    })

    describe('from_cursor: 1', () => {
        const from_cursor = 1;
        describe('empty', () => {
            const eventstore = new InMemoryEventStore();
            it('should return empty iterator', async () => {
                const iterator = eventstore.get_events({ from_cursor });
                const result = await iterator.next();
                expect(result.done).toBe(true);
            });
        })
        describe('with one event', () => {
            const eventstore = new InMemoryEventStore();
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
            it('should return empty iterator', async () => {
                const iterator = eventstore.get_events({ from_cursor });
                const result = await iterator.next();
                expect(result.done).toBe(true);
            });
        })
        describe('with two events', () => {
            const eventstore = new InMemoryEventStore();
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
            it('should return one events', async () => {
                const iterator = eventstore.get_events({ from_cursor });
                {
                    const result = await iterator.next();
                    expect(result.done).toBe(false);
                    expect(result.value).toEqual(events[1]);
                }
            });
        })
        describe('with n events', () => {
            const eventstore = new InMemoryEventStore();
            const n_iterations = getRandomInt(5, 100);
            const events: eventstore.Event[] = []
            for (let i = 0; i < n_iterations; i++) {
                const event: eventstore.Event = {
                    id: uuid(),
                    type: uuid(),
                    logical_clock: i + 1,
                    unix_timestamp: Date.now(),
                    data: { test: uuid() },
                }
                events.push(event);
                eventstore.put(event);
            }
            it('should return n - 1 events', async () => {
                const iterator = eventstore.get_events({ from_cursor });
                for (let i = 1; i < n_iterations; i++) {
                    const result = await iterator.next();
                    expect(result.done).toBe(false);
                    expect(result.value).toEqual(events[i]);
                }
            });
        })
    })
})
