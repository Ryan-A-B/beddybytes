import mqtt from "mqtt";
import { v4 as uuid } from "uuid";
import { List } from "immutable";
import LoggingService, { Severity } from "../LoggingService";
import Service, { ServiceStateChangedEvent } from "../Service";
import AuthorizationService, { AuthorizationServiceState } from "../AuthorizationService";
import { load_account_from_local_storage } from "../AuthorizationService/AuthorizationClient";
import settings from "../../settings";
import { clientStatusTopic } from "./topics";
import { new_webrtc_inbox_payload, newConnectedPayload, newDisconnectedPayload } from "./payloads";

export type MQTTServiceState = AwaitingLogin | WaitingForAccessTokenToBeReady | WaitingForAccessTokenToConnect | Ready | Connecting | Connected;

interface SubscribeCommand {
    action: "subscribe";
    subscribe: {
        topic_filter: string;
    };
}

interface PublishCommand {
    action: "publish";
    publish: {
        topic: string;
        payload: string;
    };
}

type Command = SubscribeCommand | PublishCommand;

interface ServiceProxy {
    authorization_service: AuthorizationService;
    logging_service: LoggingService;
    dispatch_event(event: Event): void;
    call_subscriptions(message: MessageReceived): void;
    set_state(state: MQTTServiceState): void;
    handle_connect(): void;
    handle_message(topic: string, payload: Buffer): void;
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
        throw new Error("Cannot publish MQTT message unless MQTT is connected or connecting");
    }

    public is_connected(): boolean {
        return false;
    }

    public subscribe(proxy: ServiceProxy, topic_filter: string): void {
        throw new Error("Cannot subscribe to MQTT topic unless MQTT is connecting or connected");
    }

    public unsubscribe(proxy: ServiceProxy, topic_filter: string): void {
        // Default is to ignore unsubscribe requests.
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

class AwaitingLogin extends AbstractState {
    public readonly name = "AwaitingLogin";

    public connect = (proxy: ServiceProxy): void => {
        proxy.logging_service.log({
            severity: Severity.Warning,
            message: "Cannot connect MQTT service until login is complete",
        });
    }

    public handle_authorization_service_state_changed = (proxy: ServiceProxy, event: ServiceStateChangedEvent<AuthorizationServiceState>): void => {
        if (event.current_state.login_required) return;
        if (!event.current_state.access_token_available) {
            proxy.set_state(new WaitingForAccessTokenToBeReady());
            return;
        }
        proxy.set_state(new Ready(load_account_id()));
    }
}

class WaitingForAccessTokenToBeReady extends AbstractState {
    public readonly name = "WaitingForAccessTokenToBeReady";

    public connect = (proxy: ServiceProxy): void => {
        proxy.set_state(new WaitingForAccessTokenToConnect(List()));
    }

    public handle_authorization_service_state_changed = (proxy: ServiceProxy, event: ServiceStateChangedEvent<AuthorizationServiceState>): void => {
        if (event.current_state.login_required) {
            proxy.set_state(new AwaitingLogin());
            return;
        }
        if (!event.current_state.access_token_available) return;
        proxy.set_state(new Ready(load_account_id()));
    }
}

class WaitingForAccessTokenToConnect extends AbstractState {
    public readonly name = "WaitingForAccessTokenToConnect";
    private readonly commands: List<Command>;

    constructor(commands: List<Command>) {
        super();
        this.commands = commands;
    }

    public subscribe = (proxy: ServiceProxy, topic_filter: string): void => {
        proxy.set_state(new WaitingForAccessTokenToConnect(this.commands.push({
            action: "subscribe",
            subscribe: { topic_filter },
        })));
    }

    public publish = (proxy: ServiceProxy, topic: string, payload: string): void => {
        proxy.set_state(new WaitingForAccessTokenToConnect(this.commands.push({
            action: "publish",
            publish: { topic, payload },
        })));
    }

    public handle_authorization_service_state_changed = (proxy: ServiceProxy, event: ServiceStateChangedEvent<AuthorizationServiceState>): void => {
        if (event.current_state.login_required) {
            proxy.set_state(new AwaitingLogin());
            return;
        }
        if (!event.current_state.access_token_available) return;
        connect_mqtt(proxy, load_account_id(), this.commands);
    }
}

class Ready extends AbstractState {
    public readonly name = "Ready";
    private readonly account_id: string;

    constructor(account_id: string) {
        super();
        this.account_id = account_id;
    }

    public connect = (proxy: ServiceProxy): void => {
        connect_mqtt(proxy, this.account_id, List());
    }

}

const connect_mqtt = (proxy: ServiceProxy, account_id: string, commands: List<Command>): void => {
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
            topic: clientStatusTopic(account_id, settings.API.clientID),
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
        accountID: account_id,
        connectionID,
        requestID,
        commands,
    }));
};

interface NewConnectingInput {
    client: MQTTClient;
    accountID: string;
    connectionID: string;
    requestID: string;
    commands: List<Command>;
}

class Connecting extends AbstractState {
    public readonly name = "Connecting";
    private readonly client: MQTTClient;
    private readonly accountID: string;
    private readonly connectionID: string;
    private readonly requestID: string;
    private readonly commands: List<Command>;

    constructor(input: NewConnectingInput) {
        super();
        this.client = input.client;
        this.accountID = input.accountID;
        this.connectionID = input.connectionID;
        this.requestID = input.requestID;
        this.commands = input.commands;
    }

    public handle_connect = (proxy: ServiceProxy): void => {
        this.client.publish(clientStatusTopic(this.accountID, settings.API.clientID), JSON.stringify(newConnectedPayload({
            connectionID: this.connectionID,
            requestID: this.requestID,
            atMillis: Date.now(),
        })));
        const connected = new Connected({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: this.requestID,
        });
        this.commands.forEach((command) => {
            if (command.action === "subscribe") {
                const topic_filter = command.subscribe.topic_filter;
                if (!proxy.list_topic_filters().includes(topic_filter)) return;
                connected.subscribe(proxy, topic_filter);
                return;
            }
            connected.publish(proxy, command.publish.topic, command.publish.payload);
        });
        proxy.set_state(connected);
    }

    public subscribe = (proxy: ServiceProxy, topic_filter: string): void => {
        proxy.set_state(new Connecting({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: this.requestID,
            commands: this.commands.push({
                action: "subscribe",
                subscribe: { topic_filter },
            }),
        }));
    }

    public publish = (proxy: ServiceProxy, topic: string, payload: string): void => {
        proxy.set_state(new Connecting({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: this.requestID,
            commands: this.commands.push({
                action: "publish",
                publish: { topic, payload },
            }),
        }));
    }

}

interface NewConnectedInput {
    client: MQTTClient;
    accountID: string;
    connectionID: string;
    requestID: string;
}

class Connected extends AbstractState {
    public readonly name = "Connected";
    private readonly client: MQTTClient;
    public readonly account_id: string;
    public readonly connection_id: string;
    private readonly requestID: string;
    private readonly account_scope: string;

    constructor(input: NewConnectedInput) {
        super();
        this.client = input.client;
        this.account_id = input.accountID;
        this.connection_id = input.connectionID;
        this.requestID = input.requestID;
        this.account_scope = `accounts/${input.accountID}/`;
    }

    public publish = (proxy: ServiceProxy, topic: string, payload: string): void => {
        this.client.publish(this.account_scope + topic, payload);
    }

    public is_connected = (): boolean => {
        return true;
    }

    public subscribe = (proxy: ServiceProxy, topic_filter: string): void => {
        this.client.subscribe(this.account_scope + topic_filter);
    }

    public unsubscribe = (proxy: ServiceProxy, topic_filter: string): void => {
        this.client.unsubscribe(this.account_scope + topic_filter);
    }

    public disconnect = (proxy: ServiceProxy): void => {
        this.client.publish(clientStatusTopic(this.account_id, settings.API.clientID), JSON.stringify(newDisconnectedPayload({
            connectionID: this.connection_id,
            requestID: this.requestID,
            atMillis: Date.now(),
            reason: "clean",
        })));
        this.client.end();
        proxy.set_state(new Ready(this.account_id));
    }

    public handle_message = (proxy: ServiceProxy, topic: string, payload: Buffer): void => {
        const message = new MessageReceived(topic, payload.toString());
        proxy.dispatch_event(message);
        proxy.call_subscriptions(message);
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
            initial_state: new_initial_state(input.authorization_service),
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

    private publish = (topic: string, payload: string): void => {
        this.get_state().publish(this.proxy, topic, payload);
    }

    private subscribe = (topic_filter: string): void => {
        if (!this.increment_topic_filter_ref_count(topic_filter)) return;
        try {
            this.get_state().subscribe(this.proxy, topic_filter);
        } catch (error) {
            this.decrement_topic_filter_ref_count(topic_filter);
            throw error;
        }
    }

    private subscribe_with_callback = (topic_filter: string, callback: MessageHandler): Subscription => {
        const subscription = this.add_subscription(topic_filter, callback);
        try {
            this.subscribe(topic_filter);
        } catch (error) {
            this.subscriptions.delete(subscription.id);
            throw error;
        }
        return subscription;
    }

    private unsubscribe = (topic_filter: string): void => {
        if (!this.decrement_topic_filter_ref_count(topic_filter)) return;
        this.get_state().unsubscribe(this.proxy, topic_filter);
    }

    public disconnect = (): void => {
        this.get_state().disconnect(this.proxy);
    }

    public subscribe_to_webrtc_inbox = (callback: MessageHandler): Subscription => {
        return this.subscribe_with_callback(`clients/${settings.API.clientID}/webrtc_inbox`, callback);
    }

    public subscribe_to_client_status = (callback: MessageHandler): Subscription => {
        return this.subscribe_with_callback("clients/+/status", callback);
    }

    public subscribe_to_control_inbox = (callback: MessageHandler): Subscription => {
        return this.subscribe_with_callback(`clients/${settings.API.clientID}/control_inbox`, callback);
    }

    public subscribe_to_baby_stations = (callback: MessageHandler): Subscription => {
        return this.subscribe_with_callback("baby_stations", callback);
    }

    public subscribe_to_parent_stations = (callback: MessageHandler): Subscription => {
        return this.subscribe_with_callback("parent_stations", callback);
    }

    public publish_baby_station_announcement = (payload: string): void => {
        this.publish("baby_stations", payload);
    }

    public publish_control_inbox = (client_id: string, payload: string): void => {
        this.publish(`clients/${client_id}/control_inbox`, payload);
    }

    public publish_webrtc_description = (peer_client_id: string, description: RTCSessionDescriptionInit): void => {
        this.publish_webrtc(peer_client_id, { description }, "Cannot publish WebRTC description unless MQTT is connecting or connected");
    }

    public publish_webrtc_candidate = (peer_client_id: string, candidate: RTCIceCandidateInit): void => {
        this.publish_webrtc(peer_client_id, { candidate }, "Cannot publish WebRTC candidate unless MQTT is connecting or connected");
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

    private add_subscription = (topic_filter: string, callback: MessageHandler): CallbackSubscription => {
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
        const accountless_topic = remove_account_scope(message.topic);
        this.subscriptions.forEach((subscription) => {
            if (!subscription.test(accountless_topic)) return;
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

    private publish_webrtc = (peer_client_id: string, data: WebRTCSignalData, error_message: string): void => {
        try {
            this.publish(
                `clients/${peer_client_id}/webrtc_inbox`,
                JSON.stringify(new_webrtc_inbox_payload(settings.API.clientID, data)),
            );
        } catch {
            throw new Error(error_message);
        }
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

interface WebRTCSignalData {
    description?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

export interface Subscription {
    readonly topic_filter: string;
    readonly callback: MessageHandler;
    readonly test: (topic: string) => boolean;
    close: () => void;
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

const new_initial_state = (authorization_service: AuthorizationService): MQTTServiceState => {
    if (authorization_service.login_required) return new AwaitingLogin();
    if (authorization_service.access_token_available) return new Ready(load_account_id());
    return new WaitingForAccessTokenToBeReady();
};

const remove_account_scope = (topic: string): string => {
    const match = topic.match(/^accounts\/[^/]+\/(.+)$/);
    if (match === null) return topic;
    return match[1];
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
