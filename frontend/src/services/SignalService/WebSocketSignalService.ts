import { List } from 'immutable';
import { v4 as uuid } from 'uuid';
import settings from "../../settings";
import Service, { ServiceStateChangedEvent, SetStateFunction } from '../Service';
import LoggingService, { Severity } from '../LoggingService';
import sleep from '../../utils/sleep';

const WebSocketCloseCodeNormalClosure = 1000;

const InitialRetryDelay = 1000;
const MaxRetryDelay = 10 * 1000;

export interface SendSignalInput {
    to_connection_id: string;
    data: any;
}

interface ServiceProxy {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    connection_id: string;
    set_state: SetStateFunction<WebSocketSignalState>;
    connect: (id: string, access_token: string) => void;
    send_signal: (input: SendSignalInput) => void;
    keep_alive: () => void;
    reconnect_after_delay: (id: string, retry_delay: number) => void;
    add_event_listeners: (ws: WebSocket) => void;
    remove_event_listeners: (ws: WebSocket) => void;
    dispatch_event: (event: Event) => void;
}

abstract class AbstractState {
    public abstract name: string;

    public abstract start: (service: ServiceProxy) => void;
    public abstract connect: (service: ServiceProxy, id: string, access_token: string) => void;
    public abstract stop: (service: ServiceProxy) => void;
    public abstract send_signal: (service: ServiceProxy, input: SendSignalInput) => void;
    public abstract keep_alive: (service: ServiceProxy) => void;

    public abstract handle_open: (serivce: ServiceProxy, event: Event) => void;
    public abstract handle_message: (serivce: ServiceProxy, event: MessageEvent) => void;
    public abstract handle_close: (serivce: ServiceProxy, event: CloseEvent) => void;
}

class NotConnected extends AbstractState {
    public name = 'not_connected';

    public start = async (service: ServiceProxy) => {
        const id = uuid();
        service.set_state(new PreparingToConnect(id));
        const access_token = await service.authorization_service.get_access_token();
        service.connect(id, access_token);
    }

    public connect = async (service: ServiceProxy, access_token: string) => {
        // do nothing
    }

    public stop = (service: ServiceProxy) => {
        // do nothing
    }

    public send_signal = (service: ServiceProxy, input: SendSignalInput) => {
        throw new Error('Not connected');
    }

    public keep_alive = (service: ServiceProxy) => {
        // do nothing
    }

    public handle_open = (service: ServiceProxy, event: Event) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_open called in NotConnected state',
        })
    }

    public handle_message = (service: ServiceProxy, event: MessageEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_message called in NotConnected state',
        });
    }

    public handle_close = (service: ServiceProxy, event: CloseEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: `WebSocket closed with code ${event.code} in NotConnected state`,
        });
    }
}

class PreparingToConnect extends AbstractState {
    public name = 'preparing_to_connect';
    protected id: string;
    protected signal_queue: List<SendSignalInput>;

    constructor(id: string, signal_queue: List<SendSignalInput> = List()) {
        super();
        this.id = id;
        this.signal_queue = signal_queue;
    }

    public start = (service: ServiceProxy) => {
        // do nothing
    }

    public connect = async (service: ServiceProxy, id: string, access_token: string) => {
        if (this.id !== id) return;
        const ws = this.create_web_socket(service, access_token);
        service.set_state(new Connecting(ws, this.signal_queue));
    }

    protected create_web_socket = (service: ServiceProxy, access_token: string): WebSocket => {
        const query_parameters = new URLSearchParams();
        query_parameters.set('access_token', access_token);
        const ws = new WebSocket(`wss://${settings.API.host}/clients/${settings.API.clientID}/connections/${service.connection_id}?${query_parameters.toString()}`);
        service.add_event_listeners(ws);
        return ws;
    }

    public stop = (service: ServiceProxy) => {
        service.set_state(new NotConnected());
    }

    public send_signal = (service: ServiceProxy, input: SendSignalInput) => {
        this.signal_queue = this.signal_queue.push(input);
    }

    public keep_alive = (service: ServiceProxy) => {
        // do nothing
    }

    public handle_open = (service: ServiceProxy, event: Event) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_open called in PreparingToConnect state',
        });
    }

    public handle_message = (service: ServiceProxy, event: MessageEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_message called in PreparingToConnect state',
        });
    }

    public handle_close = (service: ServiceProxy, event: CloseEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: `WebSocket closed with code ${event.code} in PreparingToConnect state`,
        });
    }
}

class Connecting extends AbstractState {
    public name = 'connecting';
    private ws: WebSocket;
    protected signal_queue: List<SendSignalInput>;

    constructor(ws: WebSocket, signal_queue: List<SendSignalInput>) {
        super();
        this.ws = ws;
        this.signal_queue = signal_queue;
    }

    public start = (service: ServiceProxy) => {
        // do nothing
    }

    public connect = async (service: ServiceProxy, access_token: string) => {
        // do nothing
    }

    public stop = (service: ServiceProxy) => {
        service.remove_event_listeners(this.ws);
        this.ws.close(WebSocketCloseCodeNormalClosure);
        service.set_state(new NotConnected());
    }

    public send_signal = (service: ServiceProxy, input: SendSignalInput) => {
        this.signal_queue = this.signal_queue.push(input);
    }

    public keep_alive = (service: ServiceProxy) => {
        // do nothing
    }

    public handle_open = (service: ServiceProxy, event: Event) => {
        service.set_state(new Connected(this.ws));
        this.signal_queue.forEach((signal) => {
            service.send_signal(signal);
        })
        service.keep_alive();
    }

    public handle_message = (service: ServiceProxy, event: MessageEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_message called in Connecting state',
        });
    }

    public handle_close = (service: ServiceProxy, event: CloseEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: `WebSocket closed with code ${event.code}, reconnecting in ${InitialRetryDelay}ms`,
        });
        const id = uuid();
        service.set_state(new PreparingToReconnect(id, InitialRetryDelay));
        service.reconnect_after_delay(id, InitialRetryDelay);
    }
}

class Connected extends AbstractState {
    public name = 'connected';
    private ws: WebSocket;
    private pong_event_target: EventTarget = new EventTarget();

    constructor(ws: WebSocket) {
        super();
        this.ws = ws;
    }

    public start = (service: ServiceProxy) => {
        // do nothing
    }

    public connect = async (service: ServiceProxy, access_token: string) => {
        // do nothing
    }

    public stop = (service: ServiceProxy) => {
        service.remove_event_listeners(this.ws);
        this.ws.close(WebSocketCloseCodeNormalClosure);
        service.set_state(new NotConnected());
    }

    public send_signal = (service: ServiceProxy, input: SendSignalInput) => {
        this.ws.send(JSON.stringify({
            type: 'signal',
            signal: input,
        }));
    }

    public keep_alive = async (service: ServiceProxy) => {
        const pingInterval = 30000;
        try {
            this.send_ping(this.ws);
            await this.wait_for_pong();
            setTimeout(service.keep_alive, pingInterval);
        } catch (err: unknown) {
            service.logging_service.log({
                severity: Severity.Warning,
                message: "WebSocket keep-alive failed"
            });
            const id = uuid();
            service.remove_event_listeners(this.ws);
            service.set_state(new PreparingToReconnect(id, InitialRetryDelay));
            service.reconnect_after_delay(id, InitialRetryDelay);
        }
    }

    private send_ping = (ws: WebSocket) => {
        ws.send(JSON.stringify({
            type: 'ping',
        }));
    }

    private wait_for_pong = (): Promise<void> => {
        const pong_timeout = 10000;
        return new Promise((resolve, reject) => {
            let done = false;
            const handle_pong = () => {
                if (done) return;
                done = true;
                resolve();
            }
            this.pong_event_target.addEventListener('pong', handle_pong);
            setTimeout(() => {
                if (done) return;
                done = true;
                reject(new Error('WebSocket pong timeout'));
                this.pong_event_target.removeEventListener('pong', handle_pong);
            }, pong_timeout);
        });
    }

    public handle_open = (service: ServiceProxy, event: Event) => {
        throw new Error('Already connected');
    }

    public handle_message = (service: ServiceProxy, event: MessageEvent) => {
        const message = JSON.parse(event.data);
        switch (message.type) {
            case 'signal':
                this.handle_signal(service, message);
                return;
            case 'pong':
                this.handle_pong();
                return;
        }
    }

    private handle_signal = (service: ServiceProxy, message: any) => {
        service.dispatch_event(new SignalEvent(message.signal));
    }

    private handle_pong = () => {
        this.pong_event_target.dispatchEvent(new Event('pong'));
    }

    public handle_close = (service: ServiceProxy, event: CloseEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: `WebSocket closed with code ${event.code}, reconnecting in ${InitialRetryDelay}ms`,
        });
        const id = uuid();
        service.set_state(new PreparingToReconnect(id, InitialRetryDelay));
        service.reconnect_after_delay(id, InitialRetryDelay);
    }
}

class PreparingToReconnect extends PreparingToConnect {
    public name = 'preparing_to_reconnect';
    private retry_delay: number;

    constructor(id: string, retry_delay: number) {
        super(id);
        this.retry_delay = retry_delay;
    }

    public connect = async (service: ServiceProxy, id: string, access_token: string) => {
        if (this.id !== id) return;
        const ws = this.create_web_socket(service, access_token);
        service.set_state(new Reconnecting(ws, this.signal_queue, this.retry_delay));
    }
}

class Reconnecting extends Connecting {
    public name = 'reconnecting';
    private retry_delay: number;

    constructor(ws: WebSocket, signal_queue: List<SendSignalInput>, retry_delay: number) {
        super(ws, signal_queue);
        this.retry_delay = retry_delay;
    }

    public handle_close = (service: ServiceProxy, event: CloseEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: `WebSocket closed with code ${event.code}, reconnecting in ${this.retry_delay}ms`,
        });
        const next_retry_delay = this.get_next_retry_delay();
        const id = uuid();
        service.set_state(new PreparingToReconnect(id, next_retry_delay));
        service.reconnect_after_delay(id, next_retry_delay);
    }

    private get_next_retry_delay = () => {
        const next_retry_delay = this.retry_delay * 2;
        if (next_retry_delay > MaxRetryDelay) return MaxRetryDelay;
        return next_retry_delay;
    }
}

export type WebSocketSignalState =
    NotConnected |
    PreparingToConnect |
    Connecting |
    Connected |
    PreparingToReconnect |
    Reconnecting;

interface NewWebSocketSignalServiceInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

class WebSocketSignalService extends Service<WebSocketSignalState> implements SignalService {
    public readonly name = 'WebSocketSignalService';
    private authorization_service: AuthorizationService;

    private proxy: ServiceProxy;

    public readonly connection_id: string;

    constructor(input: NewWebSocketSignalServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: new NotConnected(),
        });
        this.logging_service = input.logging_service;
        this.authorization_service = input.authorization_service;
        this.connection_id = uuid(); // TODO this is more of a session id now
        this.proxy = {
            logging_service: this.logging_service,
            authorization_service: this.authorization_service,
            connection_id: this.connection_id,
            set_state: this.set_state,
            connect: this.connect,
            send_signal: this.send_signal,
            keep_alive: this.keep_alive,
            reconnect_after_delay: this.reconnect_after_delay,
            add_event_listeners: this.add_event_listeners,
            remove_event_listeners: this.remove_event_listeners,
            dispatch_event: this.dispatch_event,
        };
    }

    protected to_string = (state: WebSocketSignalState): string => {
        return state.name;
    }

    public start = () => {
        const state = this.get_state();
        state.start(this.proxy);
    }

    private connect = async (id: string, access_token: string) => {
        const state = this.get_state();
        state.connect(this.proxy, id, access_token);
    }

    private handle_open = (event: Event) => {
        const state = this.get_state();
        state.handle_open(this.proxy, event);
    }

    private handle_message = (event: MessageEvent) => {
        const state = this.get_state();
        state.handle_message(this.proxy, event);
    }

    public send_signal = (input: SendSignalInput) => {
        const state = this.get_state();
        state.send_signal(this.proxy, input);
    }

    private dispatch_event = (event: Event) => {
        this.dispatchEvent(event);
    }

    private keep_alive = async () => {
        const state = this.get_state();
        state.keep_alive(this.proxy);
    }

    private handle_error = (event: Event) => {
        this.logging_service.log({
            severity: Severity.Warning,
            message: `WebSocket error: event.type: ${event.type}`
        });
    }

    private handle_close = (event: CloseEvent) => {
        const state = this.get_state();
        state.handle_close(this.proxy, event);
    }

    private reconnect_after_delay = async (id: string, retry_delay: number) => {
        await sleep(retry_delay);
        const access_token = await this.authorization_service.get_access_token();
        this.connect(id, access_token);
    }

    public stop = () => {
        const state = this.get_state();
        state.stop(this.proxy);
    }

    private add_event_listeners = (ws: WebSocket) => {
        ws.addEventListener('open', this.handle_open);
        ws.addEventListener('message', this.handle_message);
        ws.addEventListener('error', this.handle_error);
        ws.addEventListener('close', this.handle_close);
    }

    private remove_event_listeners = (ws: WebSocket) => {
        ws.removeEventListener('open', this.handle_open);
        ws.removeEventListener('message', this.handle_message);
        ws.removeEventListener('error', this.handle_error);
        ws.removeEventListener('close', this.handle_close);
    }
}

export default WebSocketSignalService;

export class SignalEvent extends Event {
    public readonly signal: IncomingSignal;

    constructor(signal: any) {
        super('signal', { bubbles: true });
        this.signal = signal;
    }
}

export interface IncomingSignal {
    from_connection_id: string;
    data: {
        description?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
        close?: null;
    }
}

interface WebSocketSignalService extends Service<WebSocketSignalState> {
    addEventListener<K extends keyof EventMap>(type: K, listener: (this: EventSource, ev: EventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: 'state_changed', listener: (this: EventSource, ev: ServiceStateChangedEvent<WebSocketSignalState>) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

    removeEventListener<K extends keyof EventMap>(type: K, listener: (this: EventSource, ev: EventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: 'state_changed', listener: (this: EventSource, ev: ServiceStateChangedEvent<WebSocketSignalState>) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface EventMap {
    "signal": SignalEvent;
}

export interface SignalService extends Service<WebSocketSignalState> {
    send_signal: (input: SendSignalInput) => void;

    addEventListener<K extends keyof EventMap>(type: K, listener: (this: EventSource, ev: EventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: 'state_changed', listener: (this: EventSource, ev: ServiceStateChangedEvent<WebSocketSignalState>) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

    removeEventListener<K extends keyof EventMap>(type: K, listener: (this: EventSource, ev: EventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: 'state_changed', listener: (this: EventSource, ev: ServiceStateChangedEvent<WebSocketSignalState>) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}