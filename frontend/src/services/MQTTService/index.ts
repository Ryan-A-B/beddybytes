import mqtt from "mqtt";
import { v4 as uuid } from "uuid";
import LoggingService, { Severity } from "../LoggingService";
import Service, { ServiceStateChangedEvent } from "../Service";
import AuthorizationService, { AuthorizationServiceState } from "../AuthorizationService";
import { load_account_from_local_storage } from "../AuthorizationService/AuthorizationClient";
import settings from "../../settings";
import { client_webrtc_inbox_topic, clientStatusTopic } from "./topics";
import { new_webrtc_inbox_payload, newConnectedPayload, newDisconnectedPayload } from "./payloads";

export type MQTTServiceState = WaitingForAccessTokenToBeAvailable | Ready | Connecting | Connected;

interface ServiceProxy {
    authorization_service: AuthorizationService;
    logging_service: LoggingService;
    dispatch_event(event: Event): void;
    call_subscriptions(message: MessageReceived): void;
    set_state(state: MQTTServiceState): void;
    handle_connect(): void;
    handle_message(topic: string, payload: Buffer): void;
    add_subscription(topic_filter: string, callback: MessageHandler): Subscription;
    subscribe_with_callback(topic_filter: string, callback: MessageHandler): Subscription;
    list_topic_filters(): string[];
}

abstract class AbstractState {
    public abstract readonly name: string;

    public connect(proxy: ServiceProxy): void {
        // Default is to ignore connect requests.
    }

    public handle_connect(proxy: ServiceProxy): void {
        // Default is to ignore MQTT connect events.
    }

    public publish(proxy: ServiceProxy, topic: string, payload: string): void {
        // Default is to ignore publish requests.
    }

    public subscribe(proxy: ServiceProxy, topic_filter: string): void {
        // Default is to ignore subscribe requests.
    }

    public subscribe_with_callback(proxy: ServiceProxy, topic_filter: string, callback: MessageHandler): Subscription {
        return new NoopSubscription(topic_filter, callback);
    }

    public subscribe_to_webrtc_inbox(proxy: ServiceProxy, callback: MessageHandler): Subscription {
        throw new Error("Cannot subscribe to WebRTC inbox until an access token is available");
    }

    public unsubscribe(proxy: ServiceProxy, topic_filter: string): void {
        // Default is to ignore unsubscribe requests.
    }

    public publish_webrtc_description(proxy: ServiceProxy, peer_client_id: string, description: RTCSessionDescriptionInit): void {
        throw new Error("Cannot publish WebRTC description unless MQTT is connected");
    }

    public publish_webrtc_candidate(proxy: ServiceProxy, peer_client_id: string, candidate: RTCIceCandidateInit): void {
        throw new Error("Cannot publish WebRTC candidate unless MQTT is connected");
    }

    public disconnect(proxy: ServiceProxy): void {
        // Default is to ignore disconnect requests.
    }

    public handle_message(proxy: ServiceProxy, topic: string, payload: Buffer): void {
        // Default is to ignore MQTT messages.
    }

    public handle_authorization_service_state_changed(proxy: ServiceProxy, event: ServiceStateChangedEvent<AuthorizationServiceState>): void {
        // Default is to ignore authorization changes.
    }
}

class WaitingForAccessTokenToBeAvailable extends AbstractState {
    public readonly name = "WaitingForAccessTokenToBeAvailable";

    public connect(proxy: ServiceProxy): void {
        proxy.logging_service.log({
            severity: Severity.Warning,
            message: "Cannot connect MQTT service until an access token is available",
        });
    }

    public handle_authorization_service_state_changed(proxy: ServiceProxy, event: ServiceStateChangedEvent<AuthorizationServiceState>): void {
        if (!event.current_state.access_token_available) return;
        proxy.set_state(new Ready(load_account_id()));
    }
}

class Ready extends AbstractState {
    public readonly name = "Ready";
    private readonly account_id: string;

    constructor(account_id: string) {
        super();
        this.account_id = account_id;
    }

    public connect(proxy: ServiceProxy): void {
        const connectionID = uuid();
        const requestID = uuid();
        const client = mqtt.connect(`wss://${settings.MQTT.host}`, {            
            keepalive: 3,
            protocolId: "MQTT",
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 10 * 1000,
            clientId: settings.API.clientID,
            will: {
                topic: clientStatusTopic(this.account_id, settings.API.clientID),
                payload: JSON.stringify(newDisconnectedPayload({
                    connectionID,
                    requestID,
                    atMillis: 0,
                    reason: "unexpected",
                })),
                qos: 1,
                retain: false,
            },
            transformWsUrl: (url: string): string => {
                const transformedURL = new URL(url);
                transformedURL.searchParams.set("access_token", proxy.authorization_service.get_access_token());
                return transformedURL.toString();
            },
        });
        client.on("connect", proxy.handle_connect);
        client.on("message", proxy.handle_message);
        proxy.set_state(new Connecting({
            client,
            accountID: this.account_id,
            clientID: settings.API.clientID,
            connectionID,
            requestID,
        }));
    }

    public subscribe_to_webrtc_inbox(proxy: ServiceProxy, callback: MessageHandler): Subscription {
        return proxy.subscribe_with_callback(client_webrtc_inbox_topic(this.account_id, settings.API.clientID), callback);
    }
}

interface NewConnectingInput {
    client: MQTTClient;
    accountID: string;
    clientID: string;
    connectionID: string;
    requestID: string;
}

class Connecting extends AbstractState {
    public readonly name = "Connecting";
    private readonly client: MQTTClient;
    private readonly accountID: string;
    private readonly clientID: string;
    private readonly connectionID: string;
    private readonly requestID: string;

    constructor(input: NewConnectingInput) {
        super();
        this.client = input.client;
        this.accountID = input.accountID;
        this.clientID = input.clientID;
        this.connectionID = input.connectionID;
        this.requestID = input.requestID;
    }

    public handle_connect(proxy: ServiceProxy): void {
        this.client.publish(clientStatusTopic(this.accountID, this.clientID), JSON.stringify(newConnectedPayload({
            connectionID: this.connectionID,
            requestID: this.requestID,
            atMillis: Date.now(),
        })));
        proxy.list_topic_filters().forEach((topic_filter) => {
            this.client.subscribe(topic_filter);
        });
        proxy.set_state(new Connected({
            client: this.client,
            accountID: this.accountID,
            clientID: this.clientID,
            connectionID: this.connectionID,
            requestID: this.requestID,
        }));
    }

    public subscribe_to_webrtc_inbox(proxy: ServiceProxy, callback: MessageHandler): Subscription {
        return proxy.subscribe_with_callback(client_webrtc_inbox_topic(this.accountID, this.clientID), callback);
    }
}

interface NewConnectedInput {
    client: MQTTClient;
    accountID: string;
    clientID: string;
    connectionID: string;
    requestID: string;
}

class Connected extends AbstractState {
    public readonly name = "Connected";
    private readonly client: MQTTClient;
    public readonly account_id: string;
    public readonly client_id: string;
    public readonly connection_id: string;
    private readonly requestID: string;

    constructor(input: NewConnectedInput) {
        super();
        this.client = input.client;
        this.account_id = input.accountID;
        this.client_id = input.clientID;
        this.connection_id = input.connectionID;
        this.requestID = input.requestID;
    }

    public publish(proxy: ServiceProxy, topic: string, payload: string): void {
        this.client.publish(topic, payload);
    }

    public subscribe(proxy: ServiceProxy, topic_filter: string): void {
        this.client.subscribe(topic_filter);
    }

    public subscribe_with_callback(proxy: ServiceProxy, topic_filter: string, callback: MessageHandler): Subscription {
        this.client.subscribe(topic_filter);
        return proxy.add_subscription(topic_filter, callback);
    }

    public subscribe_to_webrtc_inbox(proxy: ServiceProxy, callback: MessageHandler): Subscription {
        return proxy.subscribe_with_callback(client_webrtc_inbox_topic(this.account_id, this.client_id), callback);
    }

    public unsubscribe(proxy: ServiceProxy, topic_filter: string): void {
        this.client.unsubscribe(topic_filter);
    }

    public disconnect(proxy: ServiceProxy): void {
        this.client.publish(clientStatusTopic(this.account_id, this.client_id), JSON.stringify(newDisconnectedPayload({
            connectionID: this.connection_id,
            requestID: this.requestID,
            atMillis: Date.now(),
            reason: "clean",
        })));
        this.client.end();
        proxy.set_state(new Ready(this.account_id));
    }

    public handle_message(proxy: ServiceProxy, topic: string, payload: Buffer): void {
        const message = new MessageReceived(topic, payload.toString());
        proxy.dispatch_event(message);
        proxy.call_subscriptions(message);
    }

    public publish_webrtc_description(proxy: ServiceProxy, peer_client_id: string, description: RTCSessionDescriptionInit): void {
        this.client.publish(
            client_webrtc_inbox_topic(this.account_id, peer_client_id),
            JSON.stringify(new_webrtc_inbox_payload(this.client_id, { description })),
        );
    }

    public publish_webrtc_candidate(proxy: ServiceProxy, peer_client_id: string, candidate: RTCIceCandidateInit): void {
        this.client.publish(
            client_webrtc_inbox_topic(this.account_id, peer_client_id),
            JSON.stringify(new_webrtc_inbox_payload(this.client_id, { candidate })),
        );
    }
}

interface NewMQTTServiceInput {
    authorization_service: AuthorizationService;
    logging_service: LoggingService;
}

class MQTTService extends Service<MQTTServiceState> {
    protected readonly name = "MQTTService";
    private readonly authorization_service: AuthorizationService;
    private readonly proxy: ServiceProxy;
    private readonly subscriptions: Map<string, Subscription> = new Map();
    private readonly topic_filter_ref_counts: Map<string, number> = new Map();

    constructor(input: NewMQTTServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: input.authorization_service.access_token_available
                ? new Ready(load_account_id())
                : new WaitingForAccessTokenToBeAvailable(),
        });
        this.authorization_service = input.authorization_service;
        this.proxy = {
            authorization_service: input.authorization_service,
            logging_service: input.logging_service,
            dispatch_event: this.dispatch_event,
            call_subscriptions: this.call_subscriptions,
            set_state: this.set_state,
            handle_connect: this.handle_connect,
            handle_message: this.handle_message,
            add_subscription: this.add_subscription,
            subscribe_with_callback: this.subscribe_with_callback,
            list_topic_filters: this.list_topic_filters,
        };
        this.authorization_service.addEventListener("state_changed", this.handle_authorization_service_state_changed);
    }

    protected to_string = (state: MQTTServiceState): string => {
        return state.name;
    }

    public connect = (): void => {
        this.get_state().connect(this.proxy);
    }

    public publish = (topic: string, payload: string): void => {
        this.get_state().publish(this.proxy, topic, payload);
    }

    public subscribe = (topic_filter: string): void => {
        if (!this.increment_topic_filter_ref_count(topic_filter)) return;
        this.get_state().subscribe(this.proxy, topic_filter);
    }

    public subscribe_with_callback = (topic_filter: string, callback: MessageHandler): Subscription => {
        const should_subscribe = this.increment_topic_filter_ref_count(topic_filter);
        const subscription = this.add_subscription(topic_filter, callback);
        if (should_subscribe) this.get_state().subscribe(this.proxy, topic_filter);
        return subscription;
    }

    public unsubscribe = (topic_filter: string): void => {
        if (!this.decrement_topic_filter_ref_count(topic_filter)) return;
        this.get_state().unsubscribe(this.proxy, topic_filter);
    }

    public disconnect = (): void => {
        this.get_state().disconnect(this.proxy);
    }

    public subscribe_to_webrtc_inbox = (callback: MessageHandler): Subscription => {
        return this.get_state().subscribe_to_webrtc_inbox(this.proxy, callback);
    }

    public publish_webrtc_description = (peer_client_id: string, description: RTCSessionDescriptionInit): void => {
        this.get_state().publish_webrtc_description(this.proxy, peer_client_id, description);
    }

    public publish_webrtc_candidate = (peer_client_id: string, candidate: RTCIceCandidateInit): void => {
        this.get_state().publish_webrtc_candidate(this.proxy, peer_client_id, candidate);
    }

    private handle_authorization_service_state_changed = (event: ServiceStateChangedEvent<AuthorizationServiceState>): void => {
        this.get_state().handle_authorization_service_state_changed(this.proxy, event);
    }

    private handle_connect = (): void => {
        this.get_state().handle_connect(this.proxy);
    }

    private handle_message = (topic: string, payload: Buffer): void => {
        this.get_state().handle_message(this.proxy, topic, payload);
    }

    private dispatch_event = (event: Event): void => {
        this.dispatchEvent(event);
    }

    private add_subscription = (topic_filter: string, callback: MessageHandler): Subscription => {
        const subscription = new CallbackSubscription(
            uuid(),
            topic_filter,
            callback,
            this.remove_subscription,
            make_topic_filter_test(topic_filter),
        );
        this.subscriptions.set(subscription.id, subscription);
        return subscription;
    }

    private remove_subscription = (subscription: CallbackSubscription): void => {
        if (!this.subscriptions.has(subscription.id)) return;
        this.subscriptions.delete(subscription.id);
        if (!this.decrement_topic_filter_ref_count(subscription.topic_filter)) return;
        this.get_state().unsubscribe(this.proxy, subscription.topic_filter);
    }

    private call_subscriptions = (message: MessageReceived): void => {
        this.subscriptions.forEach((subscription) => {
            if (!subscription.test(message.topic)) return;
            subscription.callback(message);
        });
    }

    private increment_topic_filter_ref_count = (topic_filter: string): boolean => {
        const current_count = this.topic_filter_ref_counts.get(topic_filter) ?? 0;
        this.topic_filter_ref_counts.set(topic_filter, current_count + 1);
        return current_count === 0;
    }

    private decrement_topic_filter_ref_count = (topic_filter: string): boolean => {
        const current_count = this.topic_filter_ref_counts.get(topic_filter);
        if (current_count === undefined) return false;
        if (current_count <= 1) {
            this.topic_filter_ref_counts.delete(topic_filter);
            return true;
        }
        this.topic_filter_ref_counts.set(topic_filter, current_count - 1);
        return false;
    }

    private list_topic_filters = (): string[] => {
        return Array.from(this.topic_filter_ref_counts.keys());
    }
}

export default MQTTService;

export class MessageReceived extends Event {
    public readonly topic: string;
    public readonly payload: string;

    constructor(topic: string, payload: string) {
        super("message_received");
        this.topic = topic;
        this.payload = payload;
    }
}

export type MessageHandler = (message: MessageReceived) => void;

export interface Subscription {
    readonly topic_filter: string;
    readonly callback: MessageHandler;
    readonly test: (topic: string) => boolean;
    close: () => void;
}

class NoopSubscription implements Subscription {
    public readonly test = (): boolean => false;

    constructor(
        public readonly topic_filter: string,
        public readonly callback: MessageHandler,
    ) { }

    public close = (): void => {
        // Nothing to close.
    }
}

class CallbackSubscription implements Subscription {
    private closed = false;

    constructor(
        public readonly id: string,
        public readonly topic_filter: string,
        public readonly callback: MessageHandler,
        private readonly remove: (subscription: CallbackSubscription) => void,
        public readonly test: (topic: string) => boolean,
    ) { }

    public close = (): void => {
        if (this.closed) return;
        this.closed = true;
        this.remove(this);
    }
}

export const make_topic_filter_test = (topic_filter: string): (topic: string) => boolean => {
    const escaped_segments = topic_filter.split("/").map((segment) => {
        if (segment === "+") return "[^/]+";
        return escape_regex(segment);
    });
    const regex = new RegExp(`^${escaped_segments.join("/")}$`);
    return (topic: string): boolean => regex.test(topic);
};

const escape_regex = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const load_account_id = (): string => {
    const account = load_account_from_local_storage();
    if (account === null) throw new Error("Cannot create ready MQTT service without an account");
    return account.id;
};

interface MQTTService extends Service<MQTTServiceState> {
    addEventListener(type: "message_received", listener: (this: EventSource, ev: MessageReceived) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: "state_changed", listener: (this: EventSource, ev: ServiceStateChangedEvent<MQTTServiceState>) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

    removeEventListener(type: "message_received", listener: (this: EventSource, ev: MessageReceived) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: "state_changed", listener: (this: EventSource, ev: ServiceStateChangedEvent<MQTTServiceState>) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface MQTTClient {
    on(event: "connect", listener: () => void): MQTTClient;
    on(event: "message", listener: (topic: string, payload: Buffer) => void): MQTTClient;
    subscribe(topic: string): void;
    unsubscribe(topic: string): void;
    publish(topic: string, payload: string): void;
    end(): void;
}
