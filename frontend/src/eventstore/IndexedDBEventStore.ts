import eventstore from ".";

interface CursorWithEvent extends IDBCursorWithValue {
    value: eventstore.Event
}

class IndexedDBEventStore implements eventstore.EventStore {
    private db: IDBDatabase;

    private constructor(db: IDBDatabase) {
        this.db = db;
    }

    put(event: eventstore.Event): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction("events", "readwrite");
            const object_store = transaction.objectStore("events");
            const request = object_store.put(event);
            request.onsuccess = (event: Event) => {
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

    async get_last_event(): Promise<eventstore.Event | null> {
        const transaction = this.db.transaction("events", "readonly");
        const object_store = transaction.objectStore("events");
        const request = object_store.openCursor(null, "prev");
        const cursor = await new Promise<CursorWithEvent | null>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = reject;
        });
        if (cursor === null) return null;
        return cursor.value;
    }

    static create(name: string): Promise<IndexedDBEventStore> {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(name, 1);
            request.onsuccess = (event: Event) => {
                const db = request.result;
                resolve(new IndexedDBEventStore(db));
            };
            request.onerror = reject;
            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = request.result;
                const object_store = db.createObjectStore("events", {
                    keyPath: "logical_clock",
                    autoIncrement: false,
                });
                object_store.createIndex("logical_clock", "logical_clock", { unique: true });
            };
        });
    }
}

export default IndexedDBEventStore;
