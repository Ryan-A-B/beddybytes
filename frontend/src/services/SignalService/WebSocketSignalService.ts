import { v4 as uuid } from 'uuid';
import settings from "../../settings";
import sleep from '../../utils/sleep';
import LoggingService, { Severity } from '../LoggingService';

export const EventTypeSignalStateChange = 'signal_state_change';

const WebSocketCloseCodeNormalClosure = 1000;

interface WebSocketSignalStateConnectPending extends SignalStateConnecting {
    step: 'pending';
}

interface WebSocketSignalStateConnectionOpening extends SignalStateConnecting {
    step: 'opening';
    ws: WebSocket;
}

interface WebSocketSignalStateConnected extends SignalStateConnected {
    ws: WebSocket;
}

interface WebSocketSignalStateReconnectingPending extends SignalStateReconnecting {
    step: 'pending';
    retry_delay: number;
}

interface WebSocketSignalStateReconnectionOpening extends SignalStateReconnecting {
    step: 'opening';
    ws: WebSocket;
    retry_delay: number;
}

type WebSocketSignalState =
    SignalStateNotConnected |
    WebSocketSignalStateConnectPending |
    WebSocketSignalStateConnectionOpening |
    WebSocketSignalStateConnected |
    WebSocketSignalStateReconnectingPending |
    WebSocketSignalStateReconnectionOpening |
    SignalStateDisconnecting;

interface NewWebSocketSignalServiceInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

class WebSocketSignalService extends EventTarget implements SignalService {
    private static InitialState: WebSocketSignalState = { state: 'not_connected' };
    private static InitialRetryDelay = 1000;
    private static MaxRetryDelay = 2 * 60 * 1000;

    private logging_service: LoggingService;
    private authorization_service: AuthorizationService;
    private state: WebSocketSignalState = WebSocketSignalService.InitialState;
    private pong_event_target: EventTarget = new EventTarget();

    public readonly connection_id: string;

    constructor(input: NewWebSocketSignalServiceInput) {
        super();
        this.logging_service = input.logging_service;
        this.authorization_service = input.authorization_service;
        this.connection_id = uuid(); // TODO this is more of a session id now
    }

    public get_state = (): WebSocketSignalState => {
        return this.state;
    }

    private set_state = (state: WebSocketSignalState) => {
        this.logging_service.log({
            severity: Severity.Debug,
            message: `Signal state change: ${this.state.state} -> ${state.state}`
        });
        this.state = state;
        this.dispatchEvent(new Event(EventTypeSignalStateChange));
    }

    public start = () => {
        if (this.state.state !== 'not_connected') return;
        this.set_state({
            state: 'connecting',
            step: 'pending',
        })
        this.connect()
            .then((ws: WebSocket) => {
                this.set_state({
                    state: 'connecting',
                    step: 'opening',
                    ws: ws,
                })
            })
            .catch((err: Error) => {
                this.logging_service.log({
                    severity: Severity.Critical,
                    message: err.message
                })
                this.set_state(WebSocketSignalService.InitialState);
            })
    }

    private connect = async (): Promise<WebSocket> => {
        if (!(this.state.state === 'connecting' || this.state.state === 'reconnecting'))
            throw new Error(`Expected state to be connecting or reconnecting, but was ${this.state.state}`);
        if (this.state.step !== 'pending')
            throw new Error(`Expected step to be pending, but was ${this.state.step}`);
        const access_token = await this.authorization_service.get_access_token();
        const query_parameters = new URLSearchParams();
        query_parameters.set('access_token', access_token);
        const ws = new WebSocket(`wss://${settings.API.host}/clients/${settings.API.clientID}/connections/${this.connection_id}?${query_parameters.toString()}`);
        ws.addEventListener('open', this.on_open);
        ws.addEventListener('message', this.on_message);
        ws.addEventListener('error', this.on_error);
        ws.addEventListener('close', this.on_close);
        return ws;
    }

    private on_open = () => {
        if (!(this.state.state === 'connecting' || this.state.state === 'reconnecting')) return;
        if (this.state.step !== 'opening') return;
        this.set_state({
            state: 'connected',
            ws: this.state.ws,
        });
        this.keep_alive();
    }

    private on_message = (event: MessageEvent) => {
        if (this.state.state !== 'connected') return;
        const message = JSON.parse(event.data);
        switch (message.type) {
            case 'signal':
                this.on_signal(message);
                return;
            case 'pong':
                this.on_pong();
                return;
        }
    }

    private on_signal = (message: any) => {
        this.dispatchEvent(new CustomEvent('signal', {
            detail: message.signal,
            bubbles: true
        }));
    }

    private on_pong = () => {
        this.pong_event_target.dispatchEvent(new Event('pong'));
    }

    public send_signal = (input: SendSignalInput) => {
        // TODO wait for correct state? have a decorator to handle this?
        if (this.state.state === 'not_connected')
            throw new Error('Not connected');
        if (this.state.state === 'disconnecting')
            throw new Error('Disconnecting');
        if (this.state.state !== 'connected') return;
        this.state.ws.send(JSON.stringify({
            type: 'signal',
            signal: input,
        }));
    }

    private keep_alive = async () => {
        const pingInterval = 30000;
        if (this.state.state !== 'connected') return;
        this.send_ping(this.state.ws);
        try {
            await this.wait_for_pong();
        } catch (err: unknown) {
            this.logging_service.log({
                severity: Severity.Error,
                message: "pong timeout, reconnecting"
            });
            this.reconnect(WebSocketSignalService.InitialRetryDelay);
        }
        setTimeout(this.keep_alive, pingInterval);
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
            this.pong_event_target.addEventListener('pong', () => {
                if (done) return;
                done = true;
                resolve();
            });
            setTimeout(() => {
                if (done) return;
                done = true;
                reject(new Error('WebSocket ping timeout'));
            }, pong_timeout);
        });
    }

    private on_error = (event: Event) => {
        this.logging_service.log({
            severity: Severity.Error,
            message: `WebSocket error: ${event.type}`
        });
    }

    private on_close = (event: CloseEvent) => {
        switch (this.state.state) {
            case 'not_connected':
                return;
            case 'connecting':
                if (this.state.step === 'pending') return;
                this.logging_service.log({
                    severity: Severity.Error,
                    message: `WebSocket closed with code ${event.code}, reconnecting in ${WebSocketSignalService.InitialRetryDelay}ms`,
                });
                this.reconnect(WebSocketSignalService.InitialRetryDelay);
                return;
            case 'connected':
                this.logging_service.log({
                    severity: Severity.Error,
                    message: `WebSocket closed with code ${event.code}, reconnecting in ${WebSocketSignalService.InitialRetryDelay}ms`,
                });
                this.reconnect(WebSocketSignalService.InitialRetryDelay);
                return;
            case 'reconnecting':
                if (this.state.step === 'pending') return;
                this.logging_service.log({
                    severity: Severity.Error,
                    message: `WebSocket closed with code ${event.code}, reconnecting in ${this.state.retry_delay}ms`,
                });
                this.reconnect(this.state.retry_delay);
                return;
            case 'disconnecting':
                this.set_state(WebSocketSignalService.InitialState);
                return;
        }
    }

    private reconnect = (retry_delay: number) => {
        this.set_state({
            state: 'reconnecting',
            step: 'pending',
            retry_delay,
        });
        this.reconnect_after_delay(retry_delay);
    }

    private reconnect_after_delay = async (retry_delay: number) => {
        await sleep(retry_delay);
        try {
            retry_delay *= 2;
            if (retry_delay > WebSocketSignalService.MaxRetryDelay)
                retry_delay = WebSocketSignalService.MaxRetryDelay;
            const ws = await this.connect();
            this.set_state({
                state: 'reconnecting',
                step: 'opening',
                ws: ws,
                retry_delay,
            });
        } catch (err: unknown) {
            this.logging_service.log({
                severity: Severity.Critical,
                message: (err as Error).message
            })
            this.set_state(WebSocketSignalService.InitialState);
        }
    }

    public stop = () => {
        if (this.state.state === 'not_connected') return;
        if (this.state.state === 'connecting' && this.state.step === 'pending') {
            this.set_state(WebSocketSignalService.InitialState);
            return;
        }
        if (this.state.state === 'disconnecting') return;
        if (this.state.state === 'reconnecting' && this.state.step === 'pending') {
            this.set_state(WebSocketSignalService.InitialState);
            return;
        }
        const ws = this.state.ws;
        this.set_state({
            state: 'disconnecting',
        });
        ws.close(WebSocketCloseCodeNormalClosure);
    }
}

export default WebSocketSignalService;
