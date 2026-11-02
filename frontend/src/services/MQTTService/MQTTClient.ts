export type MQTTSubscribeCallback = (error: Error | null) => void;

export interface MQTTClient {
    readonly disconnecting: boolean;
    on(event: 'connect', listener: () => void): MQTTClient;
    on(event: 'message', listener: (topic: string, payload: Buffer) => void): MQTTClient;
    on(event: 'reconnect', listener: () => void): MQTTClient;
    on(event: 'close', listener: () => void): MQTTClient;
    on(event: 'offline', listener: () => void): MQTTClient;
    on(event: 'error', listener: (error: Error) => void): MQTTClient;
    subscribe(topics: string[], callback: MQTTSubscribeCallback): void;
    unsubscribe(topic: string): void;
    publish(topic: string, payload: string): void;
    end(force?: boolean): void;
}
