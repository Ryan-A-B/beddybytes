export interface MQTTTransportEvents {
    connect: () => void;
    message: (topic: string, payload: Buffer) => void;
    reconnect: () => void;
    close: () => void;
    offline: () => void;
    error: (error: Error) => void;
}

export interface MQTTClientEvents extends MQTTTransportEvents {
    transport_changed: () => void;
}

export type MQTTSubscribeCallback = (error: Error | null) => void;

export interface MQTTTransport {
    on(event: 'connect', listener: () => void): MQTTTransport;
    on(event: 'message', listener: (topic: string, payload: Buffer) => void): MQTTTransport;
    on(event: 'reconnect', listener: () => void): MQTTTransport;
    on(event: 'close', listener: () => void): MQTTTransport;
    on(event: 'offline', listener: () => void): MQTTTransport;
    on(event: 'error', listener: (error: Error) => void): MQTTTransport;
    subscribe(topics: string[], callback: MQTTSubscribeCallback): void;
    unsubscribe(topic: string): void;
    publish(topic: string, payload: string): void;
    end(force?: boolean): void;
}

export interface MQTTClient extends MQTTTransport {
    on<EventName extends keyof MQTTClientEvents>(event: EventName, listener: MQTTClientEvents[EventName]): MQTTClient;
}

export abstract class MQTTClientEventSource implements MQTTClient {
    private readonly listeners = new Map<keyof MQTTClientEvents, Function[]>();

    public on<EventName extends keyof MQTTClientEvents>(event: EventName, listener: MQTTClientEvents[EventName]): this {
        const listeners = this.listeners.get(event) ?? [];
        listeners.push(listener);
        this.listeners.set(event, listeners);
        return this;
    }

    protected emit<EventName extends keyof MQTTClientEvents>(event: EventName, ...args: Parameters<MQTTClientEvents[EventName]>): void {
        this.listeners.get(event)?.forEach(listener => listener(...args));
    }

    public abstract subscribe(topics: string[], callback: MQTTSubscribeCallback): void;
    public abstract unsubscribe(topic: string): void;
    public abstract publish(topic: string, payload: string): void;
    public abstract end(force?: boolean): void;
}
