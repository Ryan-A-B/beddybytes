import { v4 as uuid } from 'uuid';
import eventstore from '.';
import FollowingDecorator from './FollowingDecorator';
import NullEventStore from './NullEventStore';
import InMemoryEventStore from './InMemoryEventStore';

const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min) + min);
}

describe('FollowingDecorator', () => {
    describe('empty event store', () => {
        it('should follow one event', async () => {
            const eventstore = new FollowingDecorator(new NullEventStore());
            const iterator = eventstore.get_events({ from_cursor: 0 });
            const event: eventstore.Event<unknown> = {
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
            const events: eventstore.Event<unknown>[] = [
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
                const events: eventstore.Event<unknown>[] = []
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
    describe('event store with existing events', () => {
        it('should follow one event', async () => {
            const eventstore = new FollowingDecorator(new InMemoryEventStore());
            const n_existing_events = getRandomInt(1, 30);
            const existing_events: eventstore.Event<unknown>[] = []
            for (let i = 0; i < n_existing_events; i++) {
                existing_events.push({
                    id: uuid(),
                    type: uuid(),
                    logical_clock: i + 1,
                    unix_timestamp: Date.now(),
                    data: { test: uuid() },
                });
                eventstore.put(existing_events[i]);
            }
            const iterator = eventstore.get_events({ from_cursor: 0 });
            const event: eventstore.Event<unknown> = {
                id: uuid(),
                type: uuid(),
                logical_clock: n_existing_events + 1,
                unix_timestamp: Date.now(),
                data: {
                    test: uuid(),
                },
            }
            eventstore.put(event);
            for (let i = 0; i < n_existing_events; i++) {
                const result = await iterator.next();
                expect(result.done).toBe(false);
                expect(result.value).toEqual(existing_events[i]);
            }
            const result = await iterator.next();
            expect(result.done).toBe(false);
            expect(result.value).toEqual(event);
        });
        it('should follow two events', async () => {
            const eventstore = new FollowingDecorator(new InMemoryEventStore());
            const n_existing_events = getRandomInt(1, 30);
            const existing_events: eventstore.Event<unknown>[] = []
            for (let i = 0; i < n_existing_events; i++) {
                existing_events.push({
                    id: uuid(),
                    type: uuid(),
                    logical_clock: i + 1,
                    unix_timestamp: Date.now(),
                    data: { test: uuid() },
                });
                eventstore.put(existing_events[i]);
            }
            const iterator = eventstore.get_events({ from_cursor: 0 });
            const events: eventstore.Event<unknown>[] = [
                {
                    id: uuid(),
                    type: uuid(),
                    logical_clock: n_existing_events + 1,
                    unix_timestamp: Date.now(),
                    data: { test: uuid() },
                },
                {
                    id: uuid(),
                    type: uuid(),
                    logical_clock: n_existing_events + 2,
                    unix_timestamp: Date.now(),
                    data: { test: uuid() },
                },
            ]
            events.forEach(event => eventstore.put(event));
            for (let i = 0; i < n_existing_events; i++) {
                const result = await iterator.next();
                expect(result.done).toBe(false);
                expect(result.value).toEqual(existing_events[i]);
            }
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
            const eventstore = new FollowingDecorator(new InMemoryEventStore());
            const n_existing_events = getRandomInt(1, 30);
            const existing_events: eventstore.Event<unknown>[] = []
            for (let i = 0; i < n_existing_events; i++) {
                existing_events.push({
                    id: uuid(),
                    type: uuid(),
                    logical_clock: i + 1,
                    unix_timestamp: Date.now(),
                    data: { test: uuid() },
                });
                eventstore.put(existing_events[i]);
            }
            const iterator = eventstore.get_events({ from_cursor: 0 });
            const n_iterations = getRandomInt(1, 10);
            const allEvents: eventstore.Event<unknown>[][] = []
            for (let i = 0; i < n_iterations; i++) {
                const n_events = getRandomInt(1, 30);
                const events: eventstore.Event<unknown>[] = []
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
                allEvents.push(events);
            }
            for (let i = 0; i < n_existing_events; i++) {
                const result = await iterator.next();
                expect(result.done).toBe(false);
                expect(result.value).toEqual(existing_events[i]);
            }
            for (let i = 0; i < n_iterations; i++) {
                const events = allEvents[i];
                for (let j = 0; j < events.length; j++) {
                    const result = await iterator.next();
                    expect(result.done).toBe(false);
                    expect(result.value).toEqual(events[j]);
                }
            }
        });
    });
});
