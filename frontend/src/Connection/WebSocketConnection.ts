import { v4 as uuid } from 'uuid';
import settings from '../settings';
import authorization from '../authorization';
import Connection, { Signal } from './Connection';

const sleep =  (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

interface IncomingMessageEvent {
    type: 'event';
    event: IncomingEvent;
}

interface IncomingMessageSignal {
    type: 'signal';
    signal: IncomingSignal;
}

interface IncomingEvent {
    type: string;
    data: any;
}

interface IncomingSignal {
    from_connection_id: string;
    data: any;
}

type IncomingMessage = IncomingMessageEvent | IncomingMessageSignal;

class WebSocketConnection extends EventTarget implements Connection {
    private static MAX_RECONNECT_DELAY = 30000;
    private static INITIAL_RECONNECT_DELAY = 1000;
    readonly id: string;
    private ws: WebSocket;
    private reconnecting = false;
    private reconnectDelay = WebSocketConnection.INITIAL_RECONNECT_DELAY;
    private constructor(connectionID: string, ws: WebSocket) {
        super();
        this.id = connectionID;
        this.ws = ws;
        this.ws.onmessage = this.onMessage;
        this.ws.onerror = this.onError;
        this.ws.onclose = this.onClose;
    }

    private onOpen = (event: Event) => {
        this.reconnectDelay = WebSocketConnection.INITIAL_RECONNECT_DELAY;
    }

    private onMessage = (event: MessageEvent) => {
        const message: IncomingMessage = JSON.parse(event.data);
        switch (message.type) {
            case 'event':
                return this.onEvent(message.event);
            case 'signal':
                return this.onSignal(message.signal);
        }
    }

    private onError = (event: Event) => {
        console.error(event);
    }

    private onClose = (event: CloseEvent) => {
        if (event.wasClean === true) return;
        console.error(`WebSocket closed with code ${event.code}, reconnecting...`);
        this.reconnect();
    }

    private onEvent = (event: IncomingEvent) => {
        this.dispatchEvent(new CustomEvent(event.type, { detail: event.data }));
    }

    private onSignal = (signal: IncomingSignal) => {
        this.dispatchEvent(new CustomEvent('signal', { detail: signal }));
    }

    sendSignal = (input: Signal) => {
        this.ws.send(JSON.stringify({
            type: 'signal',
            signal: input,
        }));
    }

    private reconnect = async () => {
        if (this.reconnecting === true) return;
        this.reconnecting = true;
        await sleep(this.reconnectDelay);
        this.reconnectDelay *= 2;
        if (this.reconnectDelay > WebSocketConnection.MAX_RECONNECT_DELAY)
            this.reconnectDelay = WebSocketConnection.MAX_RECONNECT_DELAY;
        this.reconnecting = false;
        this.ws = await WebSocketConnection.connect(this.id);
        this.ws.onopen = this.onOpen;
        this.ws.onmessage = this.onMessage;
        this.ws.onerror = this.onError;
        this.ws.onclose = this.onClose;
    }

    static async create(): Promise<Connection> {
        const connectionID = uuid();
        const ws = await WebSocketConnection.connect(connectionID);
        return new WebSocketConnection(connectionID, ws);
    }

    private static async connect(connectionID: string): Promise<WebSocket> {
        const accessToken = await authorization.getAccessToken();
        return new WebSocket(`wss://${settings.API.host}/clients/${settings.API.clientID}/connections/${connectionID}?access_token=${accessToken}`);
    }
}

export default WebSocketConnection;
