import SessionService from ".";
import LoggingService, { LogInput } from "../../LoggingService";
import settings from "../../../settings";

let date_now_spy: jest.SpyInstance<number, []>;

describe("BabyStation SessionService", () => {
    beforeEach(() => {
        date_now_spy = jest.spyOn(Date, "now").mockReturnValue(123);
    });

    afterEach(() => {
        date_now_spy.mockRestore();
    });

    test("starts ready", () => {
        const service = new SessionService({
            logging_service: new MockLoggingService(),
            mqtt_service: new MockMQTTService(),
        });

        expect(service.get_state().name).toBe("Ready");
    });

    test("start session connects MQTT and transitions to session starting", () => {
        const mqtt_service = new MockMQTTService();
        const service = new SessionService({
            logging_service: new MockLoggingService(),
            // @ts-ignore
            mqtt_service,
        });

        service.start_session({ name: "Nursery" });

        expect(mqtt_service.connect).toHaveBeenCalledTimes(1);
        expect(service.get_state().name).toBe("SessionStarting");
    });

    test("when MQTT connects, subscribes to parent stations and publishes baby station announcement", () => {
        const mqtt_service = new MockMQTTService();
        const service = new SessionService({
            logging_service: new MockLoggingService(),
            // @ts-ignore
            mqtt_service,
        });
        service.start_session({ name: "Nursery" });

        mqtt_service.set_connected();

        expect(mqtt_service.calls[0]).toEqual({
            name: "subscribe_to_parent_stations",
            topic: "parent_stations",
        });
        expect(mqtt_service.calls[1]).toEqual(expect.objectContaining({
            name: "publish_baby_station_announcement",
            topic: "baby_stations",
        }));
        expect(JSON.parse(mqtt_service.calls[1].payload ?? "")).toEqual({
            type: "announcement",
            at_millis: 123,
            announcement: {
                client_id: settings.API.clientID,
                connection_id: "connection-1",
                session_id: expect.any(String),
                name: "Nursery",
                started_at_millis: 123,
            },
        });
        expect(service.get_state().name).toBe("SessionRunning");
    });

    test("end session disconnects MQTT and returns to ready while running", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_started_service(mqtt_service);

        service.end_session();

        expect(mqtt_service.parent_stations_subscription.close).toHaveBeenCalledTimes(1);
        expect(mqtt_service.disconnect).toHaveBeenCalledTimes(1);
        expect(service.get_state().name).toBe("Ready");
    });

    test("responds to parent station announcement messages while running", () => {
        const mqtt_service = new MockMQTTService();
        new_started_service(mqtt_service);

        mqtt_service.dispatch_message("accounts/account-1/parent_stations", JSON.stringify({
            type: "announcement",
            at_millis: 456,
            announcement: {
                client_id: "parent-client",
                connection_id: "parent-connection",
            },
        }));

        const publishCall = mqtt_service.calls[mqtt_service.calls.length - 1];
        expect(publishCall).toEqual(expect.objectContaining({
            name: "publish_control_inbox",
            topic: "clients/parent-client/control_inbox",
        }));
        expect(JSON.parse(publishCall.payload ?? "")).toEqual({
            type: "baby_station_announcement",
            at_millis: 123,
            baby_station_announcement: {
                client_id: settings.API.clientID,
                connection_id: "connection-1",
                session_id: expect.any(String),
                name: "Nursery",
                started_at_millis: 123,
            },
        });
    });

    test("ignores unrelated MQTT messages while running", () => {
        const mqtt_service = new MockMQTTService();
        new_started_service(mqtt_service);
        const callCount = mqtt_service.calls.length;

        mqtt_service.dispatch_message("accounts/account-1/baby_stations", JSON.stringify({
            type: "announcement",
            announcement: {
                client_id: "other",
                connection_id: "other",
            },
        }));

        expect(mqtt_service.calls).toHaveLength(callCount);
    });
});

class MockLoggingService implements LoggingService {
    public readonly logs: LogInput[] = [];

    set_account_id = jest.fn();

    log = jest.fn((input: LogInput) => {
        this.logs.push(input);
    });
}

class MockMQTTService extends EventTarget {
    private state: any = { name: "Ready" };
    public readonly calls: Array<{ name: string; topic: string; payload?: string }> = [];
    public parent_stations_callback: ((message: MockMessageReceived) => void) | null = null;
    public readonly parent_stations_subscription = {
        topic_filter: "parent_stations",
        callback: jest.fn(),
        test: jest.fn(),
        close: jest.fn(),
    };

    connect = jest.fn();
    disconnect = jest.fn();
    subscribe_to_parent_stations = jest.fn((callback: (message: MockMessageReceived) => void) => {
        this.parent_stations_callback = callback;
        this.calls.push({ name: "subscribe_to_parent_stations", topic: "parent_stations" });
        return this.parent_stations_subscription;
    });
    publish_baby_station_announcement = jest.fn((payload: string) => {
        this.calls.push({ name: "publish_baby_station_announcement", topic: "baby_stations", payload });
    });
    publish_control_inbox = jest.fn((client_id: string, payload: string) => {
        this.calls.push({ name: "publish_control_inbox", topic: `clients/${client_id}/control_inbox`, payload });
    });

    get_state = jest.fn(() => this.state);

    set_connected(): void {
        const previous_state = this.state;
        this.state = {
            name: "Connected",
            account_id: "account-1",
            client_id: "baby-client",
            connection_id: "connection-1",
        };
        this.dispatchEvent(new MockStateChangedEvent(previous_state, this.state));
    }

    dispatch_message(topic: string, payload: string): void {
        this.parent_stations_callback?.(new MockMessageReceived(topic, payload));
    }
}

const new_started_service = (mqtt_service: MockMQTTService): SessionService => {
    const service = new SessionService({
        logging_service: new MockLoggingService(),
        // @ts-ignore
        mqtt_service,
    });
    service.start_session({ name: "Nursery" });
    mqtt_service.set_connected();
    return service;
};

class MockStateChangedEvent extends Event {
    public readonly previous_state: unknown;
    public readonly current_state: unknown;

    constructor(previousState: unknown, currentState: unknown) {
        super("state_changed");
        this.previous_state = previousState;
        this.current_state = currentState;
    }
}

class MockMessageReceived extends Event {
    public readonly topic: string;
    public readonly payload: string;

    constructor(topic: string, payload: string) {
        super("message_received");
        this.topic = topic;
        this.payload = payload;
    }
}
