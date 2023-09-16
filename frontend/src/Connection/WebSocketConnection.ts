import { v4 as uuid } from 'uuid';
import settings from '../settings';
import authorization from '../authorization';
import Connection, { Signal } from './Connection';

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
    readonly id: string;
    private ws: WebSocket;
    private constructor(connectionID: string, ws: WebSocket) {
        super();
        this.id = connectionID;
        this.ws = ws;
        this.ws.onmessage = this.onMessage;
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

    static async create(): Promise<Connection> {
        const connectionID = uuid();
        const accessToken = await authorization.getAccessToken();
        const ws = new WebSocket(`wss://${settings.API.host}/clients/${settings.API.clientID}/connections/${connectionID}?access_token=${accessToken}`);
        return new WebSocketConnection(connectionID, ws);
    }
}

export default WebSocketConnection;
