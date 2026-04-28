jest.mock("mqtt", () => ({
    __esModule: true,
    default: {
        connect: jest.fn(),
    },
}));

import mqtt from "mqtt";
import MQTTService, { MessageReceived } from ".";
import LoggingService, { LogInput } from "../LoggingService";
import AuthorizationService from "../AuthorizationService";
import { AuthorizationClient, TokenOutput } from "../AuthorizationService/AuthorizationClient";
import { Account } from "../AuthorizationService/Account";
import settings from "../../settings";

const default_token_output: TokenOutput = {
    token_type: "Bearer",
    access_token: "test_access_token",
    expires_in: 60 * 60,
};

const default_account: Account = {
    id: "test_account_id",
    user: {
        id: "test_user_id",
        email: "test@example.com",
        password_salt: "salt",
        password_hash: "hash",
    },
};

const mocked_mqtt = mqtt as unknown as { connect: jest.Mock };
let mqtt_client: MockMQTTClient;
let date_now_spy: jest.SpyInstance<number, []>;

describe("MQTTService", () => {
    beforeEach(() => {
        localStorage.removeItem("account");
        mqtt_client = new MockMQTTClient();
        mocked_mqtt.connect.mockReset();
        mocked_mqtt.connect.mockReturnValue(mqtt_client);
        date_now_spy = jest.spyOn(Date, "now").mockReturnValue(123);
    });

    afterEach(() => {
        date_now_spy.mockRestore();
    });

    test("starts waiting for an access token when one is not available", () => {
        const service = new MQTTService({
            authorization_service: new_authorization_service(),
            logging_service: new MockLoggingService(),
        });

        expect(service.get_state().name).toBe("WaitingForAccessTokenToBeAvailable");
    });

    test("starts ready when an access token is available", () => {
        const authorization_service = new_authorization_service();
        authorization_service.apply_token_output(default_token_output);
        localStorage.setItem("account", JSON.stringify(default_account));

        const service = new MQTTService({
            authorization_service,
            logging_service: new MockLoggingService(),
        });

        expect(service.get_state().name).toBe("Ready");
    });

    test("becomes ready when an access token becomes available", () => {
        const authorization_service = new_authorization_service();
        const service = new MQTTService({
            authorization_service,
            logging_service: new MockLoggingService(),
        });

        localStorage.setItem("account", JSON.stringify(default_account));
        authorization_service.apply_token_output(default_token_output);

        expect(service.get_state().name).toBe("Ready");
    });

    test("captures account when becoming ready", () => {
        const authorization_service = new_authorization_service();
        const service = new MQTTService({
            authorization_service,
            logging_service: new MockLoggingService(),
        });

        localStorage.setItem("account", JSON.stringify(default_account));
        authorization_service.apply_token_output(default_token_output);
        localStorage.removeItem("account");
        service.connect();

        expect(mocked_mqtt.connect).toHaveBeenCalledWith(`wss://${settings.MQTT.host}`, expect.objectContaining({
            will: expect.objectContaining({
                topic: `accounts/${default_account.id}/clients/${settings.API.clientID}/status`,
            }),
        }));
    });

    test("logs warning and stays waiting when connecting without an access token", () => {
        const logging_service = new MockLoggingService();
        const service = new MQTTService({
            authorization_service: new_authorization_service(),
            logging_service,
        });

        service.connect();

        expect(service.get_state().name).toBe("WaitingForAccessTokenToBeAvailable");
        expect(logging_service.logs).toEqual([
            expect.objectContaining({
                message: "Cannot connect MQTT service until an access token is available",
            }),
        ]);
    });

    test("connects MQTT client and transitions to connecting when ready", () => {
        const authorization_service = new_authorization_service();
        authorization_service.apply_token_output(default_token_output);
        localStorage.setItem("account", JSON.stringify(default_account));
        const service = new MQTTService({
            authorization_service,
            logging_service: new MockLoggingService(),
        });

        service.connect();

        expect(mocked_mqtt.connect).toHaveBeenCalledWith(`wss://${settings.MQTT.host}`, expect.objectContaining({
            clientId: settings.API.clientID,
            will: expect.objectContaining({
                topic: `accounts/${default_account.id}/clients/${settings.API.clientID}/status`,
            }),
        }));
        const options = mocked_mqtt.connect.mock.calls[0][1];
        expect(JSON.parse(options.will.payload)).toEqual({
            type: "disconnected",
            disconnected: {
                connection_id: expect.any(String),
                request_id: expect.any(String),
                at_millis: 0,
                reason: "unexpected",
            },
        });
        const transformedURL = options.transformWsUrl("wss://mqtt.example.test/mqtt");
        expect(transformedURL).toBe("wss://mqtt.example.test/mqtt?access_token=test_access_token");
        expect(mqtt_client.listenersByEvent.connect).toHaveLength(1);
        expect(mqtt_client.listenersByEvent.message).toHaveLength(1);
        expect(service.get_state().name).toBe("Connecting");
    });

    test("publishes connected status when MQTT connects", () => {
        const authorization_service = new_authorization_service();
        authorization_service.apply_token_output(default_token_output);
        localStorage.setItem("account", JSON.stringify(default_account));
        const service = new MQTTService({
            authorization_service,
            logging_service: new MockLoggingService(),
        });

        service.connect();
        mqtt_client.emit("connect");

        expect(mqtt_client.calls.map((call) => call.name)).toEqual(["publish"]);
        expect(mqtt_client.calls[0]).toEqual(expect.objectContaining({
            name: "publish",
            topic: `accounts/${default_account.id}/clients/${settings.API.clientID}/status`,
        }));
        expect(JSON.parse(mqtt_client.calls[0].payload ?? "")).toEqual({
            type: "connected",
            connected: {
                connection_id: expect.any(String),
                request_id: expect.any(String),
                at_millis: 123,
            },
        });
        expect(service.get_state().name).toBe("Connected");
    });

    test("publishes message while connected", () => {
        const service = new_connected_service();

        service.publish("accounts/test_account_id/example", "test payload");

        expect(mqtt_client.calls[mqtt_client.calls.length - 1]).toEqual({
            name: "publish",
            topic: "accounts/test_account_id/example",
            payload: "test payload",
        });
    });

    test("subscribes while connected", () => {
        const service = new_connected_service();

        service.subscribe("accounts/test_account_id/clients/+/status");

        expect(mqtt_client.calls[mqtt_client.calls.length - 1]).toEqual({
            name: "subscribe",
            topic: "accounts/test_account_id/clients/+/status",
        });
    });

    test("dispatches message received event while connected", () => {
        const service = new_connected_service();
        const received: MessageReceived[] = [];
        service.addEventListener("message_received", (event: MessageReceived) => {
            received.push(event);
        });

        mqtt_client.emit("message", "accounts/test_account_id/example", Buffer.from("test payload"));

        expect(received).toHaveLength(1);
        expect(received[0].topic).toBe("accounts/test_account_id/example");
        expect(received[0].payload).toBe("test payload");
    });

    test("publishes clean disconnected status and ends client when disconnecting while connected", () => {
        const service = new_connected_service();

        service.disconnect();

        expect(mqtt_client.calls[mqtt_client.calls.length - 1]).toEqual(expect.objectContaining({
            name: "publish",
            topic: `accounts/${default_account.id}/clients/${settings.API.clientID}/status`,
        }));
        expect(JSON.parse(mqtt_client.calls[mqtt_client.calls.length - 1].payload ?? "")).toEqual({
            type: "disconnected",
            disconnected: {
                connection_id: expect.any(String),
                request_id: expect.any(String),
                at_millis: 123,
                reason: "clean",
            },
        });
        expect(mqtt_client.end).toHaveBeenCalledTimes(1);
        expect(service.get_state().name).toBe("Ready");
    });

    test("uses the same connection and request IDs for will, connected, and clean disconnected status", () => {
        const authorization_service = new_authorization_service();
        authorization_service.apply_token_output(default_token_output);
        localStorage.setItem("account", JSON.stringify(default_account));
        const service = new MQTTService({
            authorization_service,
            logging_service: new MockLoggingService(),
        });

        service.connect();
        mqtt_client.emit("connect");
        service.disconnect();

        const connectOptions = mocked_mqtt.connect.mock.calls[0][1];
        const willPayload = JSON.parse(connectOptions.will.payload);
        const connectedPayload = JSON.parse(mqtt_client.calls[0].payload ?? "");
        const disconnectedPayload = JSON.parse(mqtt_client.calls[mqtt_client.calls.length - 1].payload ?? "");
        expect(connectedPayload.connected.connection_id).toBe(willPayload.disconnected.connection_id);
        expect(connectedPayload.connected.request_id).toBe(willPayload.disconnected.request_id);
        expect(disconnectedPayload.disconnected.connection_id).toBe(willPayload.disconnected.connection_id);
        expect(disconnectedPayload.disconnected.request_id).toBe(willPayload.disconnected.request_id);
    });
});

class MockLoggingService implements LoggingService {
    public readonly logs: LogInput[] = [];

    set_account_id = jest.fn();

    log = jest.fn((input: LogInput) => {
        this.logs.push(input);
    });
}

const new_authorization_service = (): AuthorizationService => {
    return new AuthorizationService({
        authorization_client: make_authorization_client(),
        logging_service: new MockLoggingService(),
    });
};

const make_authorization_client = (): AuthorizationClient => ({
    login: jest.fn(() => Promise.resolve(default_token_output)),
    refresh_token: jest.fn(() => Promise.resolve(default_token_output)),
    refresh_token_with_retry: jest.fn(() => Promise.resolve(default_token_output)),
    create_account: jest.fn(() => Promise.resolve(default_account)),
    get_current_account: jest.fn(() => Promise.resolve(default_account)),
    request_password_reset: jest.fn(),
    reset_password: jest.fn(),
});

const new_connected_service = (): MQTTService => {
    const authorization_service = new_authorization_service();
    authorization_service.apply_token_output(default_token_output);
    localStorage.setItem("account", JSON.stringify(default_account));
    const service = new MQTTService({
        authorization_service,
        logging_service: new MockLoggingService(),
    });
    service.connect();
    mqtt_client.emit("connect");
    return service;
};

class MockMQTTClient {
    public readonly listenersByEvent: Record<string, Function[]> = {};
    public readonly calls: Array<{ name: string; topic: string; payload?: string }> = [];

    on = jest.fn((event: string, listener: Function) => {
        this.listenersByEvent[event] = this.listenersByEvent[event] ?? [];
        this.listenersByEvent[event].push(listener);
        return this;
    });

    subscribe = jest.fn((topic: string) => {
        this.calls.push({ name: "subscribe", topic });
    });

    publish = jest.fn((topic: string, payload: string) => {
        this.calls.push({ name: "publish", topic, payload });
    });

    end = jest.fn();

    emit(event: string, ...args: unknown[]): void {
        for (const listener of this.listenersByEvent[event] ?? []) {
            listener(...args);
        }
    }
}
