import { v4 as uuid } from 'uuid';
import settings from '../settings';
import Connection, { EventTypeConnectionLost, Signal } from './Connection';
import AuthorizationService from '../services/AuthorizationService';
import eventstore from '../eventstore';
import sleep from '../utils/sleep';
import LoggingService from '../services/LoggingService';
import { Severity } from '../services/LoggingService/models';

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
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

type NewWebSocketConnectionInput = {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    connectionID: string;
    ws: WebSocket;
}

class WebSocketConnection extends EventTarget implements Connection {
    private static InitialReconnectDelay = 1000;
    private static MaxReconnectDelay = 30000;
    private logging_service: LoggingService;
    private authorization_service: AuthorizationService;
    readonly id: string;
    private ws: WebSocket;
    private reconnecting = false;
    private reconnectDelay = WebSocketConnection.InitialReconnectDelay;
    private constructor(input: NewWebSocketConnectionInput) {
        super();
        this.logging_service = input.logging_service;
        this.authorization_service = input.authorization_service;
        this.id = input.connectionID;
        this.ws = input.ws;
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
        this.logging_service.log({
            severity: Severity.Error,
            message: `WebSocket error: ${event}`,
        });
    }

    private onClose = (event: CloseEvent) => {
        if (event.wasClean === true) return;
        this.logging_service.log({
            severity: Severity.Error,
            message: `WebSocket closed with code ${event.code}, reconnecting...`,
        });
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
        this.ws = await WebSocketConnection.connect(this.authorization_service, this.id);
        this.ws.onopen = this.onOpen;
        this.ws.onmessage = this.onMessage;
        this.ws.onerror = this.onError;
        this.ws.onclose = this.onClose;
    }

    static async create(input: CreateWebSocketConnectionInput): Promise<Connection> {
        const connectionID = uuid();
        const ws = await WebSocketConnection.connect(input.authorization_service, connectionID);
        return new WebSocketConnection({
            logging_service: input.logging_service,
            authorization_service: input.authorization_service,
            connectionID,
            ws,
        });
    }

    private static async connect(authorization_service: AuthorizationService, connectionID: string): Promise<WebSocket> {
        const access_token = await authorization_service.get_access_token();
        const query_parameters = new URLSearchParams();
        query_parameters.set('access_token', access_token);
        return new WebSocket(`wss://${settings.API.host}/clients/${settings.API.clientID}/connections/${connectionID}?${query_parameters.toString()}`);
    }
}

export default WebSocketConnection;
