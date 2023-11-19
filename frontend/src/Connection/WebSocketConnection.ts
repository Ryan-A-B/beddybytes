import { v4 as uuid } from 'uuid';
import settings from '../settings';
import Connection, { EventTypeConnectionLost, Signal } from './Connection';
import AuthorizationService from '../services/AuthorizationService';
import eventstore from '../eventstore';
import authorization_service from '../instances/authorization_service';

const sleep =  (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

export const EventTypeRemoteEvent = 'remote_event';

interface IncomingMessageEvent {
    type: 'event';
    event: eventstore.Event;
}

interface IncomingMessageSignal {
    type: 'signal';
    signal: IncomingSignal;
}

interface IncomingSignal {
    from_connection_id: string;
    data: any;
}

type IncomingMessage = IncomingMessageEvent | IncomingMessageSignal;

interface CreateWebSocketConnectionInput {
    authorization_service: AuthorizationService;
}

class WebSocketConnection extends EventTarget implements Connection {
    private static InitialReconnectDelay = 1000;
    private static MaxReconnectDelay = 30000;
    readonly id: string;
    private ws: WebSocket;
    private reconnecting = false;
    private reconnectDelay = WebSocketConnection.InitialReconnectDelay;
    private constructor(connectionID: string, ws: WebSocket) {
        super();
        this.id = connectionID;
        this.ws = ws;
        this.ws.onmessage = this.onMessage;
        this.ws.onerror = this.onError;
        this.ws.onclose = this.onClose;
    }

    private onOpen = (event: Event) => {
        this.reconnectDelay = WebSocketConnection.InitialReconnectDelay;
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
        this.dispatchEvent(new Event(EventTypeConnectionLost))
        this.reconnect();
    }

    private onEvent = (event: eventstore.Event) => {
        this.dispatchEvent(new CustomEvent(EventTypeRemoteEvent, { detail: event }));
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
        if (this.reconnectDelay > WebSocketConnection.MaxReconnectDelay)
            this.reconnectDelay = WebSocketConnection.MaxReconnectDelay;
        this.reconnecting = false;
        this.ws = await WebSocketConnection.connect(this.id);
        this.ws.onopen = this.onOpen;
        this.ws.onmessage = this.onMessage;
        this.ws.onerror = this.onError;
        this.ws.onclose = this.onClose;
    }

    static async create(input: CreateWebSocketConnectionInput): Promise<Connection> {
        const connectionID = uuid();
        const ws = await WebSocketConnection.connect(connectionID);
        return new WebSocketConnection(connectionID, ws);
    }

    private static async connect(connectionID: string): Promise<WebSocket> {
        const access_token = await authorization_service.get_access_token();
        const query_parameters = new URLSearchParams();
        query_parameters.set('access_token', access_token);
        return new WebSocket(`wss://${settings.API.host}/clients/${settings.API.clientID}/connections/${connectionID}?${query_parameters.toString()}`);
    }
}

export default WebSocketConnection;
