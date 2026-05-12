import mqtt from "mqtt";
import { v4 as uuid } from "uuid";
import { List } from "immutable";
import LoggingService, { Severity } from "../LoggingService";
import Service, { ServiceStateChangedEvent } from "../Service";
import AuthorizationService, { AuthorizationServiceState } from "../AuthorizationService";
import { load_account_from_local_storage } from "../AuthorizationService/AuthorizationClient";
import settings from "../../settings";
import { clientStatusTopic } from "./topics";
import { ConnectedPayload, DisconnectedPayload, new_webrtc_inbox_payload, newParentStationAnnouncementPayload } from "./payloads";

export type MQTTServiceState = AwaitingLogin | WaitingForAccessTokenToBeReady | WaitingForAccessTokenToConnect | Ready | Connecting | Offline | OfflineAndReconnecting | SubscribingOnConnect | SubscribingAfterConnected | Connected;

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

interface PublishParentStationAnnouncementCommand {
    action: "publish_parent_station_announcement";
}

type Command = SubscribeCommand | PublishCommand | PublishParentStationAnnouncementCommand;

const AWS_IOT_MINIMUM_KEEPALIVE_SECONDS = 30;

interface ServiceProxy {
    authorization_service: AuthorizationService;
    logging_service: LoggingService;
    dispatch_event(event: Event): void;
    call_subscriptions(message: MessageReceived): void;
    set_state(state: MQTTServiceState): void;
    handle_connect(connection_id: string): void;
    handle_message(topic: string, payload: Buffer): void;
    handle_reconnect(connection_id: string): void;
    handle_close(connection_id: string): void;
    handle_offline(connection_id: string): void;
    handle_error(connection_id: string, error: Error): void;
    handle_subscribe_callback(topic_filters: string[], error: Optional<Error>): void;
    list_topic_filters(): string[];
}

abstract class AbstractState {
    public abstract readonly name: string;

    public connect(proxy: ServiceProxy): void {
        // Default is to ignore connect requests.
    }

    public handle_connect(proxy: ServiceProxy, connection_id: string): void {
        // Default is to ignore MQTT connect events.
    }

    public handle_reconnect(proxy: ServiceProxy, connection_id: string): void {
        proxy.logging_service.log({
            severity: Severity.Warning,
            message: "MQTT client reconnecting",
        });
    }

    public handle_close(proxy: ServiceProxy, connection_id: string): void {
        proxy.logging_service.log({
            severity: Severity.Warning,
            message: "MQTT client closed",
        });
    }

    public handle_offline(proxy: ServiceProxy, connection_id: string): void {
        proxy.logging_service.log({
            severity: Severity.Warning,
            message: "MQTT client offline",
        });
    }

    public handle_error(proxy: ServiceProxy, connection_id: string, error: Error): void {
        proxy.logging_service.log({
            severity: Severity.Warning,
            message: `MQTT client error: ${error.message}`,
        });
    }

    public handle_subscribe_callback(proxy: ServiceProxy, topic_filters: string[], error: Optional<Error>): void {
        // Default is to ignore MQTT subscribe callbacks.
    }

    public publish(proxy: ServiceProxy, topic: string, payload: string): void {
        throw new Error("Cannot publish MQTT message unless MQTT is connecting, offline, reconnecting, or connected");
    }

    public publish_parent_station_announcement(proxy: ServiceProxy): void {
        throw new Error("Cannot publish parent station announcement unless MQTT is connecting, offline, reconnecting, or connected");
    }

    public is_connected(): boolean {
        return false;
    }

    public is_offline(): boolean {
        return false;
    }

    public subscribe(proxy: ServiceProxy, topic_filter: string): void {
        throw new Error("Cannot subscribe to MQTT topic unless MQTT is connecting, offline, reconnecting, or connected");
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

    public publish_parent_station_announcement = (proxy: ServiceProxy): void => {
        proxy.set_state(new WaitingForAccessTokenToConnect(this.commands.push({
            action: "publish_parent_station_announcement",
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

    public handle_close = (proxy: ServiceProxy, connection_id: string): void => {
        // MQTT.js emits close after a clean end(). Ready already represents idle.
    }

}

const connect_mqtt = (proxy: ServiceProxy, account_id: string, commands: List<Command>): void => {
    const connectionID = uuid();
    const requestID = uuid();
    const client = mqtt.connect(`wss://${settings.MQTT.host}`, {
        keepalive: AWS_IOT_MINIMUM_KEEPALIVE_SECONDS,
        timerVariant: "native",
        protocolId: "MQTT",
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 1 * 1000,
        connectTimeout: 10 * 1000,
        clientId: settings.API.clientID,
        will: {
            topic: clientStatusTopic(account_id, settings.API.clientID),
            payload: JSON.stringify({
                type: "disconnected",
                connection_id: connectionID,
                request_id: requestID,
                at_millis: 0,
                disconnected: {
                    reason: "unexpected",
                },
            } satisfies DisconnectedPayload),
            qos: 1,
            retain: false,
        },
        transformWsUrl: (url: string): string => {
            const transformedURL = new URL(url);
            transformedURL.searchParams.set("access_token", proxy.authorization_service.get_access_token());
            return transformedURL.toString();
        },
    });
    client.on("connect", () => proxy.handle_connect(connectionID));
    client.on("message", proxy.handle_message);
    client.on("reconnect", () => proxy.handle_reconnect(connectionID));
    client.on("close", () => proxy.handle_close(connectionID));
    client.on("offline", () => proxy.handle_offline(connectionID));
    client.on("error", (error) => proxy.handle_error(connectionID, error));
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

    public handle_connect = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connectionID) return;
        const topic_filters = proxy.list_topic_filters();
        if (topic_filters.length > 0) {
            transition_to_subscribing_on_connect(proxy, {
                client: this.client,
                accountID: this.accountID,
                connectionID: this.connectionID,
                requestID: this.requestID,
                commands: this.commands,
                topic_filters,
            });
            return;
        }
        const connected = new Connected({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: this.requestID,
        });
        connected.publish_connected_status();
        replay_publish_commands(proxy, connected, this.commands);
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

    public publish_parent_station_announcement = (proxy: ServiceProxy): void => {
        proxy.set_state(new Connecting({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: this.requestID,
            commands: this.commands.push({
                action: "publish_parent_station_announcement",
            }),
        }));
    }

    public disconnect = (proxy: ServiceProxy): void => {
        this.client.end();
        proxy.set_state(new Ready(this.accountID));
    }

}

class Offline extends AbstractState {
    public readonly name = "Offline";
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

    public is_offline = (): boolean => {
        return true;
    }

    public handle_connect = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connectionID) return;
        proxy.logging_service.log({
            severity: Severity.Warning,
            message: "MQTT client connected while offline",
        });
    }

    public handle_reconnect = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connectionID) return;
        super.handle_reconnect(proxy, connection_id);
        proxy.set_state(new OfflineAndReconnecting({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: uuid(),
            commands: this.commands,
        }));
    }

    public handle_close = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connectionID) return;
        super.handle_close(proxy, connection_id);
    }

    public handle_offline = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connectionID) return;
        super.handle_offline(proxy, connection_id);
    }

    public subscribe = (proxy: ServiceProxy, topic_filter: string): void => {
        // Active topic filters are replayed from the service ref counts after reconnect.
    }

    public publish = (proxy: ServiceProxy, topic: string, payload: string): void => {
        proxy.set_state(new Offline({
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

    public publish_parent_station_announcement = (proxy: ServiceProxy): void => {
        proxy.set_state(new Offline({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: this.requestID,
            commands: this.commands.push({
                action: "publish_parent_station_announcement",
            }),
        }));
    }

    public disconnect = (proxy: ServiceProxy): void => {
        this.client.end();
        proxy.set_state(new Ready(this.accountID));
    }
}

class OfflineAndReconnecting extends AbstractState {
    public readonly name = "OfflineAndReconnecting";
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

    public is_offline = (): boolean => {
        return true;
    }

    public handle_connect = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connectionID) return;
        const topic_filters = proxy.list_topic_filters();
        if (topic_filters.length > 0) {
            transition_to_subscribing_on_connect(proxy, {
                client: this.client,
                accountID: this.accountID,
                connectionID: this.connectionID,
                requestID: this.requestID,
                commands: this.commands,
                topic_filters,
            });
            return;
        }
        const connected = new Connected({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: this.requestID,
        });
        connected.publish_connected_status();
        replay_publish_commands(proxy, connected, this.commands);
        proxy.set_state(connected);
    }

    public handle_reconnect = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connectionID) return;
        super.handle_reconnect(proxy, connection_id);
        proxy.set_state(new OfflineAndReconnecting({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: uuid(),
            commands: this.commands,
        }));
    }

    public handle_close = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connectionID) return;
        super.handle_close(proxy, connection_id);
        proxy.set_state(new Offline({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: this.requestID,
            commands: this.commands,
        }));
    }

    public handle_offline = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connectionID) return;
        super.handle_offline(proxy, connection_id);
        proxy.set_state(new Offline({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: this.requestID,
            commands: this.commands,
        }));
    }

    public subscribe = (proxy: ServiceProxy, topic_filter: string): void => {
        // Active topic filters are replayed from the service ref counts after reconnect.
    }

    public publish = (proxy: ServiceProxy, topic: string, payload: string): void => {
        proxy.set_state(new OfflineAndReconnecting({
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

    public publish_parent_station_announcement = (proxy: ServiceProxy): void => {
        proxy.set_state(new OfflineAndReconnecting({
            client: this.client,
            accountID: this.accountID,
            connectionID: this.connectionID,
            requestID: this.requestID,
            commands: this.commands.push({
                action: "publish_parent_station_announcement",
            }),
        }));
    }

    public disconnect = (proxy: ServiceProxy): void => {
        this.client.end();
        proxy.set_state(new Ready(this.accountID));
    }
}

interface NewConnectedInput {
    client: MQTTClient;
    accountID: string;
    connectionID: string;
    requestID: string;
}

interface NewSubscribingInput extends NewConnectedInput {
    commands: List<Command>;
    topic_filters: string[];
}

abstract class AbstractSubscribing extends AbstractState {
    public abstract readonly name: string;
    protected readonly client: MQTTClient;
    public readonly account_id: string;
    public readonly connection_id: string;
    protected readonly requestID: string;
    protected readonly account_scope: string;
    protected readonly commands: List<Command>;
    protected readonly pending_topic_filters: Set<string>;

    constructor(input: NewSubscribingInput) {
        super();
        this.client = input.client;
        this.account_id = input.accountID;
        this.connection_id = input.connectionID;
        this.requestID = input.requestID;
        this.account_scope = `accounts/${input.accountID}/`;
        this.commands = input.commands;
        this.pending_topic_filters = new Set(input.topic_filters);
    }

    public start_subscribing = (proxy: ServiceProxy): void => {
        const topic_filters = Array.from(this.pending_topic_filters);
        const topics = topic_filters.map((topic_filter) => this.account_scope + topic_filter);
        this.client.subscribe(topics, make_subscribe_callback(proxy, topic_filters));
    }

    public publish = (proxy: ServiceProxy, topic: string, payload: string): void => {
        this.set_subscribing_state(proxy, this.commands.push({
            action: "publish",
            publish: { topic, payload },
        }), Array.from(this.pending_topic_filters));
    }

    public publish_parent_station_announcement = (proxy: ServiceProxy): void => {
        this.set_subscribing_state(proxy, this.commands.push({
            action: "publish_parent_station_announcement",
        }), Array.from(this.pending_topic_filters));
    }

    public subscribe = (proxy: ServiceProxy, topic_filter: string): void => {
        if (this.pending_topic_filters.has(topic_filter)) return;
        this.set_subscribing_state(proxy, this.commands, [...Array.from(this.pending_topic_filters), topic_filter]);
        this.client.subscribe([this.account_scope + topic_filter], make_subscribe_callback(proxy, [topic_filter]));
    }

    public unsubscribe = (proxy: ServiceProxy, topic_filter: string): void => {
        this.client.unsubscribe(this.account_scope + topic_filter);
        const pending_topic_filters = Array.from(this.pending_topic_filters).filter((pending_topic_filter) => {
            return pending_topic_filter !== topic_filter;
        });
        if (pending_topic_filters.length > 0) {
            this.set_subscribing_state(proxy, this.commands, pending_topic_filters);
            return;
        }
        this.transition_to_connected(proxy, this.commands);
    }

    public disconnect = (proxy: ServiceProxy): void => {
        this.client.end();
        proxy.set_state(new Ready(this.account_id));
    }

    public handle_message = (proxy: ServiceProxy, topic: string, payload: Buffer): void => {
        const message = new MessageReceived(topic, payload.toString());
        proxy.dispatch_event(message);
        proxy.call_subscriptions(message);
    }

    public handle_subscribe_callback = (proxy: ServiceProxy, topic_filters: string[], error: Optional<Error>): void => {
        if (error !== null) {
            proxy.logging_service.log({
                severity: Severity.Warning,
                message: `MQTT subscribe failed for ${topic_filters.join(", ")}: ${error.message}`,
            });
        }
        const pending_topic_filters = Array.from(this.pending_topic_filters).filter((pending_topic_filter) => {
            return !topic_filters.includes(pending_topic_filter);
        });
        if (pending_topic_filters.length === this.pending_topic_filters.size) return;
        if (pending_topic_filters.length > 0) {
            this.set_subscribing_state(proxy, this.commands, pending_topic_filters);
            return;
        }
        this.transition_to_connected(proxy, this.commands);
    }

    public handle_reconnect = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connection_id) return;
        super.handle_reconnect(proxy, connection_id);
        proxy.set_state(new OfflineAndReconnecting({
            client: this.client,
            accountID: this.account_id,
            connectionID: this.connection_id,
            requestID: uuid(),
            commands: this.commands,
        }));
    }

    public handle_close = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connection_id) return;
        super.handle_close(proxy, connection_id);
        proxy.set_state(new Offline({
            client: this.client,
            accountID: this.account_id,
            connectionID: this.connection_id,
            requestID: this.requestID,
            commands: this.commands,
        }));
    }

    public handle_offline = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connection_id) return;
        super.handle_offline(proxy, connection_id);
        proxy.set_state(new Offline({
            client: this.client,
            accountID: this.account_id,
            connectionID: this.connection_id,
            requestID: this.requestID,
            commands: this.commands,
        }));
    }

    protected new_connected = (): Connected => {
        return new Connected({
            client: this.client,
            accountID: this.account_id,
            connectionID: this.connection_id,
            requestID: this.requestID,
        });
    }

    protected new_input = (commands: List<Command>, topic_filters: string[]): NewSubscribingInput => {
        return {
            client: this.client,
            accountID: this.account_id,
            connectionID: this.connection_id,
            requestID: this.requestID,
            commands,
            topic_filters,
        };
    }

    protected abstract set_subscribing_state(proxy: ServiceProxy, commands: List<Command>, topic_filters: string[]): void;

    protected abstract transition_to_connected(proxy: ServiceProxy, commands: List<Command>): void;
}

class SubscribingOnConnect extends AbstractSubscribing {
    public readonly name = "SubscribingOnConnect";

    protected set_subscribing_state = (proxy: ServiceProxy, commands: List<Command>, topic_filters: string[]): void => {
        proxy.set_state(new SubscribingOnConnect(this.new_input(commands, topic_filters)));
    }

    protected transition_to_connected = (proxy: ServiceProxy, commands: List<Command>): void => {
        const connected = this.new_connected();
        connected.publish_connected_status();
        replay_publish_commands(proxy, connected, commands);
        proxy.set_state(connected);
    }
}

class SubscribingAfterConnected extends AbstractSubscribing {
    public readonly name = "SubscribingAfterConnected";

    protected set_subscribing_state = (proxy: ServiceProxy, commands: List<Command>, topic_filters: string[]): void => {
        proxy.set_state(new SubscribingAfterConnected(this.new_input(commands, topic_filters)));
    }

    protected transition_to_connected = (proxy: ServiceProxy, commands: List<Command>): void => {
        const connected = this.new_connected();
        replay_publish_commands(proxy, connected, commands);
        proxy.set_state(connected);
    }
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

    public publish_connected_status = (): void => {
        const payload = JSON.stringify({
            type: "connected",
            connection_id: this.connection_id,
            request_id: this.requestID,
            at_millis: Date.now(),
        } satisfies ConnectedPayload);
        this.client.publish(clientStatusTopic(this.account_id, settings.API.clientID), payload);
    }

    public publish_parent_station_announcement = (proxy: ServiceProxy): void => {
        this.publish(proxy, "parent_stations", JSON.stringify(newParentStationAnnouncementPayload({
            client_id: settings.API.clientID,
            connection_id: this.connection_id,
        }, Date.now())));
    }

    public is_connected = (): boolean => {
        return true;
    }

    public subscribe = (proxy: ServiceProxy, topic_filter: string): void => {
        transition_to_subscribing_after_connect(proxy, {
            client: this.client,
            accountID: this.account_id,
            connectionID: this.connection_id,
            requestID: this.requestID,
            commands: List(),
            topic_filters: [topic_filter],
        });
    }

    public unsubscribe = (proxy: ServiceProxy, topic_filter: string): void => {
        this.client.unsubscribe(this.account_scope + topic_filter);
    }

    public disconnect = (proxy: ServiceProxy): void => {
        const payload = JSON.stringify({
            type: "disconnected",
            connection_id: this.connection_id,
            request_id: this.requestID,
            at_millis: Date.now(),
            disconnected: {
                reason: "clean",
            },
        } satisfies DisconnectedPayload);
        this.client.publish(clientStatusTopic(this.account_id, settings.API.clientID), payload);
        this.client.end();
        proxy.set_state(new Ready(this.account_id));
    }

    public handle_message = (proxy: ServiceProxy, topic: string, payload: Buffer): void => {
        const message = new MessageReceived(topic, payload.toString());
        proxy.dispatch_event(message);
        proxy.call_subscriptions(message);
    }

    public handle_reconnect = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connection_id) return;
        super.handle_reconnect(proxy, connection_id);
        proxy.set_state(new OfflineAndReconnecting({
            client: this.client,
            accountID: this.account_id,
            connectionID: this.connection_id,
            requestID: uuid(),
            commands: List(),
        }));
    }

    public handle_close = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connection_id) return;
        super.handle_close(proxy, connection_id);
        proxy.set_state(new Offline({
            client: this.client,
            accountID: this.account_id,
            connectionID: this.connection_id,
            requestID: this.requestID,
            commands: List(),
        }));
    }

    public handle_offline = (proxy: ServiceProxy, connection_id: string): void => {
        if (connection_id !== this.connection_id) return;
        super.handle_offline(proxy, connection_id);
        proxy.set_state(new Offline({
            client: this.client,
            accountID: this.account_id,
            connectionID: this.connection_id,
            requestID: this.requestID,
            commands: List(),
        }));
    }

}

const replay_publish_commands = (proxy: ServiceProxy, connected: Connected, commands: List<Command>): void => {
    commands.forEach((command) => {
        if (command.action === "subscribe") return;
        if (command.action === "publish_parent_station_announcement") {
            connected.publish_parent_station_announcement(proxy);
            return;
        }
        connected.publish(proxy, command.publish.topic, command.publish.payload);
    });
};

const transition_to_subscribing_on_connect = (proxy: ServiceProxy, input: NewSubscribingInput): void => {
    const state = new SubscribingOnConnect(input);
    proxy.set_state(state);
    state.start_subscribing(proxy);
};

const transition_to_subscribing_after_connect = (proxy: ServiceProxy, input: NewSubscribingInput): void => {
    const state = new SubscribingAfterConnected(input);
    proxy.set_state(state);
    state.start_subscribing(proxy);
};

const make_subscribe_callback = (proxy: ServiceProxy, topic_filters: string[]): MQTTSubscribeCallback => {
    return (error) => {
        // Prevent re-entrant state transitions if a client/mock invokes the subscribe callback synchronously.
        queueMicrotask(() => proxy.handle_subscribe_callback(topic_filters, error));
    };
};

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
            handle_reconnect: this.handle_reconnect,
            handle_close: this.handle_close,
            handle_offline: this.handle_offline,
            handle_error: this.handle_error,
            handle_subscribe_callback: this.handle_subscribe_callback,
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

    public is_offline = (): boolean => {
        return this.get_state().is_offline();
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

    public subscribe_to_client_status = (client_id: string, callback: MessageHandler): Subscription => {
        return this.subscribe_with_callback(`clients/${client_id}/status`, callback);
    }

    public subscribe_to_all_client_statuses = (callback: MessageHandler): Subscription => {
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

    public publish_parent_station_announcement = (): void => {
        this.get_state().publish_parent_station_announcement(this.proxy);
    }

    public publish_webrtc_description = (peer_client_id: string, description: RTCSessionDescriptionInit): void => {
        this.publish_webrtc(peer_client_id, { description }, "Cannot publish WebRTC description unless MQTT is connecting, offline, reconnecting, or connected");
    }

    public publish_webrtc_candidate = (peer_client_id: string, candidate: RTCIceCandidateInit): void => {
        this.publish_webrtc(peer_client_id, { candidate }, "Cannot publish WebRTC candidate unless MQTT is connecting, offline, reconnecting, or connected");
    }

    private handle_authorization_service_state_changed = (event: ServiceStateChangedEvent<AuthorizationServiceState>): void => {
        this.get_state().handle_authorization_service_state_changed(this.proxy, event);
    }

    private handle_connect = (connection_id: string): void => {
        this.get_state().handle_connect(this.proxy, connection_id);
    }

    private handle_message = (topic: string, payload: Buffer): void => {
        this.get_state().handle_message(this.proxy, topic, payload);
    }

    private handle_reconnect = (connection_id: string): void => {
        this.get_state().handle_reconnect(this.proxy, connection_id);
    }

    private handle_close = (connection_id: string): void => {
        this.get_state().handle_close(this.proxy, connection_id);
    }

    private handle_offline = (connection_id: string): void => {
        this.get_state().handle_offline(this.proxy, connection_id);
    }

    private handle_error = (connection_id: string, error: Error): void => {
        this.get_state().handle_error(this.proxy, connection_id, error);
    }

    private handle_subscribe_callback = (topic_filters: string[], error: Optional<Error>): void => {
        this.get_state().handle_subscribe_callback(this.proxy, topic_filters, error);
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
    on(event: "reconnect", listener: () => void): MQTTClient;
    on(event: "close", listener: () => void): MQTTClient;
    on(event: "offline", listener: () => void): MQTTClient;
    on(event: "error", listener: (error: Error) => void): MQTTClient;
    subscribe(topics: string[], callback: MQTTSubscribeCallback): void;
    unsubscribe(topic: string): void;
    publish(topic: string, payload: string): void;
    end(): void;
}

type MQTTSubscribeCallback = (error: Optional<Error>) => void;
