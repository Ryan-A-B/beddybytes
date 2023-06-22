const InitialReconnectDelay = 1 * 1000;
const MaxReconnectDelay = 2 * 60 * 1000;

type OnOpen = (event: Event) => void;
type OnMessage = (event: MessageEvent) => void;
type OnError = (event: Event) => void;
type OnClose = (event: CloseEvent) => void;

export default class PersistentWebSocket {
    private url: string;
    private websocket: WebSocket;
    private reconnecting: boolean = false;
    private reconnectDelay: number = InitialReconnectDelay;

    onopen: OnOpen | null = null;
    _onmessage: OnMessage | null = null;
    _onerror: OnError | null = null;
    onclose: OnClose | null = null;

    constructor(url: string) {
        this.url = url;
        this.websocket = this.connect();
    }

    private connect = () => {
        const websocket = new WebSocket(this.url);
        websocket.onopen = this.onOpen;
        websocket.onmessage = this._onmessage;
        websocket.onerror = this._onerror;
        websocket.onclose = this.onClose;
        return websocket;
    }

    private onOpen = (event: Event) => {
        this.reconnectDelay = InitialReconnectDelay;
        this.onopen && this.onopen(event);
    }

    set onmessage(onmessage: OnMessage | null) {
        this._onmessage = onmessage;
        this.websocket.onmessage;
    }

    set onerror(onerror: OnError | null) {
        this._onerror = onerror;
        this.websocket.onerror;
    }

    private onClose = (event: CloseEvent) => {
        this.onclose && this.onclose(event);
        if (event.wasClean === true) return
        console.log(`WebSocket closed with code ${event.code} and reason ${event.reason}, reconnecting...`);
        this.reconnectWebSocket();
    }

    private reconnectWebSocket = () => {
        if (this.reconnecting === true) return;
        this.reconnecting = true;
        window.setTimeout(() => {
            this.reconnecting = false;
            this.websocket = this.connect();
        }, this.reconnectDelay);
        this.reconnectDelay *= 2;
        if (this.reconnectDelay > MaxReconnectDelay)
            this.reconnectDelay = MaxReconnectDelay;
    }

    send = (data: any) => {
        this.websocket.send(data);
    }

    close = () => {
        this.websocket.onopen = null;
        this.websocket.onmessage = null;
        this.websocket.onerror = null;
        this.websocket.onclose = this.onclose;
        this.websocket.close();
    }
}