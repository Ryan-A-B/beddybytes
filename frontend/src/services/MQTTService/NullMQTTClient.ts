import { MQTTClientEventSource, MQTTSubscribeCallback } from './MQTTClient';

// Complete the local client lifecycle without opening a socket or buffering messages.
class NullMQTTClient extends MQTTClientEventSource {
    private ended = false;

    constructor() {
        super();
        queueMicrotask(() => {
            if (!this.ended) this.emit('connect');
        });
    }

    public subscribe = (topics: string[], callback: MQTTSubscribeCallback): void => {
        if (!this.ended) callback(null);
    };

    public unsubscribe = (topic: string): void => {};
    public publish = (topic: string, payload: string): void => {};
    public end = (): void => { this.ended = true; };
}

export default NullMQTTClient;
