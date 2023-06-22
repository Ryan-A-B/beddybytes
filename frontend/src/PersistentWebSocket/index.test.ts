import PersistentWebSocket from ".";

class MockWebSocket {
    constructor(url: string) {
        websocket = this;
        Promise.resolve().then(() => this.onopen && this.onopen(new Event("open")));
    }

    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;

    test_message = (event: MessageEvent) => {
        Promise.resolve().then(() => this.onmessage && this.onmessage(event));
    }

    test_close = (event: CloseEvent) => {
        Promise.resolve().then(() => this.onclose && this.onclose(event));
    }
}

let websocket: MockWebSocket | null = null;

global.WebSocket = MockWebSocket as any;

test("PersistentWebSocket", (done) => {
    const url = "ws://localhost:8080";
    const persistentWebSocket = new PersistentWebSocket(url);
    expect(persistentWebSocket).toBeDefined();
    let alreadyFailed = false
    const expectedMessage = "hello world";
    persistentWebSocket.onopen = (event) => {
        if (websocket === null) throw new Error("websocket is null");
        expect(event).toBeDefined();
        if (alreadyFailed === true) {
            websocket.test_message(new MessageEvent("message", { data: expectedMessage }));
            return;
        }
        alreadyFailed = true;
        websocket.test_close(new CloseEvent("close", { code: 1006, reason: "test" }));
    }
    persistentWebSocket.onmessage = (event) => {
        expect(event).toBeDefined();
        expect(event.data).toBe(expectedMessage);
        done();
    }
});
