import mqtt, { IClientOptions } from 'mqtt';
import AuthorizationService from '../AuthorizationService';
import { EventTypeStateChanged } from '../Service';
import { MQTTClient, MQTTClientEventSource, MQTTSubscribeCallback, MQTTTransport } from './MQTTClient';
import NullMQTTClient from './NullMQTTClient';

interface ClientInput {
    authorization_service: AuthorizationService;
    url: string;
    options: IClientOptions;
}

// The state machine owns this client. It owns the real/null transport and its
// authorization subscription, including cleanup when the connection is ended.
class AuthorizationAwareMQTTClient extends MQTTClientEventSource {
    private readonly input: ClientInput;
    private transport: MQTTTransport;
    private monitor_scope: boolean;
    private ended = false;

    constructor(input: ClientInput) {
        super();
        this.input = input;
        this.monitor_scope = input.authorization_service.get_claims().has_scope('monitor');
        this.transport = this.create_transport();
        this.bind_transport(this.transport);
        input.authorization_service.addEventListener(EventTypeStateChanged, this.handle_authorization_changed);
    }

    private create_transport = (): MQTTTransport => {
        return this.monitor_scope ? mqtt.connect(this.input.url, this.input.options) : new NullMQTTClient();
    };

    private is_current = (transport: MQTTTransport): boolean => !this.ended && transport === this.transport;

    private bind_transport = (transport: MQTTTransport): void => {
        transport.on('connect', () => { if (this.is_current(transport)) this.emit('connect'); });
        transport.on('message', (topic, payload) => { if (this.is_current(transport)) this.emit('message', topic, payload); });
        transport.on('reconnect', () => { if (this.is_current(transport)) this.emit('reconnect'); });
        transport.on('close', () => { if (this.is_current(transport)) this.emit('close'); });
        transport.on('offline', () => { if (this.is_current(transport)) this.emit('offline'); });
        transport.on('error', error => { if (this.is_current(transport)) this.emit('error', error); });
    };

    private handle_authorization_changed = (): void => {
        const monitor_scope = this.input.authorization_service.get_claims().has_scope('monitor');
        if (this.ended || monitor_scope === this.monitor_scope) return;
        this.monitor_scope = monitor_scope;
        const previous_transport = this.transport;
        this.transport = this.create_transport();
        this.bind_transport(this.transport);
        // Ignore callbacks from the old transport before force-ending it. Its
        // queued messages and automatic retries must not survive scope loss.
        previous_transport.end(true);
        this.emit('transport_changed');
    };

    public subscribe = (topics: string[], callback: MQTTSubscribeCallback): void => {
        const transport = this.transport;
        transport.subscribe(topics, error => {
            if (this.is_current(transport)) callback(error);
        });
    };

    public unsubscribe = (topic: string): void => { this.transport.unsubscribe(topic); };
    public publish = (topic: string, payload: string): void => { this.transport.publish(topic, payload); };

    public end = (force?: boolean): void => {
        if (this.ended) return;
        this.ended = true;
        this.input.authorization_service.removeEventListener(EventTypeStateChanged, this.handle_authorization_changed);
        this.transport.end(force);
    };
}

const create_mqtt_client = (authorization_service: AuthorizationService, url: string, options: IClientOptions): MQTTClient => {
    return new AuthorizationAwareMQTTClient({ authorization_service, url, options });
};

export default create_mqtt_client;
