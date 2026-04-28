import mqtt from "mqtt";
import { v4 as uuid } from "uuid";
import LoggingService, { Severity } from "../LoggingService";
import Service, { ServiceStateChangedEvent } from "../Service";
import AuthorizationService, { AuthorizationServiceState } from "../AuthorizationService";
import { load_account_from_local_storage } from "../AuthorizationService/AuthorizationClient";
import settings from "../../settings";
import { clientStatusTopic } from "./topics";
import { newConnectedPayload, newDisconnectedPayload } from "./payloads";

export type MQTTServiceState = WaitingForAccessTokenToBeAvailable | Ready | Connecting | Connected;

interface ServiceProxy {
    authorization_service: AuthorizationService;
    logging_service: LoggingService;
    dispatch_event(event: Event): void;
    set_state(state: MQTTServiceState): void;
    handle_connect(): void;
    handle_message(topic: string, payload: Buffer): void;
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

    public subscribe(proxy: ServiceProxy, topicFilter: string): void {
        // Default is to ignore subscribe requests.
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
        proxy.set_state(new Connected({
            client: this.client,
            accountID: this.accountID,
            clientID: this.clientID,
            connectionID: this.connectionID,
            requestID: this.requestID,
        }));
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
    private readonly accountID: string;
    private readonly clientID: string;
    private readonly connectionID: string;
    private readonly requestID: string;

    constructor(input: NewConnectedInput) {
        super();
        this.client = input.client;
        this.accountID = input.accountID;
        this.clientID = input.clientID;
        this.connectionID = input.connectionID;
        this.requestID = input.requestID;
    }

    public publish(proxy: ServiceProxy, topic: string, payload: string): void {
        this.client.publish(topic, payload);
    }

    public subscribe(proxy: ServiceProxy, topicFilter: string): void {
        this.client.subscribe(topicFilter);
    }

    public disconnect(proxy: ServiceProxy): void {
        this.client.publish(clientStatusTopic(this.accountID, this.clientID), JSON.stringify(newDisconnectedPayload({
            connectionID: this.connectionID,
            requestID: this.requestID,
            atMillis: Date.now(),
            reason: "clean",
        })));
        this.client.end();
        proxy.set_state(new Ready(this.accountID));
    }

    public handle_message(proxy: ServiceProxy, topic: string, payload: Buffer): void {
        proxy.dispatch_event(new MessageReceived(topic, payload.toString()));
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
            set_state: this.set_state,
            handle_connect: this.handle_connect,
            handle_message: this.handle_message,
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

    public subscribe = (topicFilter: string): void => {
        this.get_state().subscribe(this.proxy, topicFilter);
    }

    public disconnect = (): void => {
        this.get_state().disconnect(this.proxy);
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
    publish(topic: string, payload: string): void;
    end(): void;
}
