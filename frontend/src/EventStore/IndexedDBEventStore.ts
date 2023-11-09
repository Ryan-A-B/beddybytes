import eventstore from "./eventstore";

interface CursorWithEvent extends IDBCursorWithValue {
    value: eventstore.Event
}

class IndexedDBEventStore implements eventstore.EventStore {
    private db: IDBDatabase;

    constructor(db: IDBDatabase) {
        this.db = db;
    }

    put(event: eventstore.Event): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction("events", "readwrite");
            const object_store = transaction.objectStore("events");
            const key = event.logical_clock;
            const request = object_store.put(event, key);
            request.onsuccess = (event) => {
                resolve();
            };
            request.onerror = reject;
        });
    }

    async *get_events(input: eventstore.GetEventIteratorInput): eventstore.AsyncEventIterator {
        const transaction = this.db.transaction("events", "readonly");
        const object_store = transaction.objectStore("events");
        const query: IDBKeyRange = IDBKeyRange.lowerBound(input.from_cursor, true);
        const request = object_store.openCursor(query);
        while (true) {
            const cursor = await new Promise<CursorWithEvent | null>((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = reject;
            });
            if (cursor === null) break;
            yield cursor.value;
            cursor.continue();
        }
    }

    static create(name: string): Promise<IndexedDBEventStore> {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(name, 1);
            request.onsuccess = (event) => {
                resolve(new IndexedDBEventStore(request.result));
            };
            request.onerror = reject;
            // TODO handle onupgradeneeded
        });
    }
}

export default IndexedDBEventStore;
