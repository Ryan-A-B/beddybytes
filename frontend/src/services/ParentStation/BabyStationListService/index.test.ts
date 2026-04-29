import BabyStationListService, { BabyStationListState } from ".";
import { MessageHandler, MessageReceived, Subscription } from "../../MQTTService";
import ConsoleLoggingService from "../../LoggingService/ConsoleLoggingService";

describe("BabyStationListService", () => {
    test("starts stopped", () => {
        const service = new_service();

        expect(service.get_state().name).toBe("Stopped");
        expect(service.list_baby_stations().size).toBe(0);
    });

    test("start creates subscriptions and transitions to running", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);

        service.start();

        expect(service.get_state().name).toBe("Running");
        expect(mqtt_service.subscribe_to_baby_stations).toHaveBeenCalledTimes(1);
        expect(mqtt_service.subscribe_to_control_inbox).toHaveBeenCalledTimes(1);
        expect(mqtt_service.subscribe_to_client_status).toHaveBeenCalledTimes(1);
    });

    test("start twice is no-op", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);

        service.start();
        service.start();

        expect(mqtt_service.subscribe_to_baby_stations).toHaveBeenCalledTimes(1);
        expect(mqtt_service.subscribe_to_control_inbox).toHaveBeenCalledTimes(1);
        expect(mqtt_service.subscribe_to_client_status).toHaveBeenCalledTimes(1);
    });

    test("stop closes subscriptions and clears list", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.start();
        mqtt_service.dispatch_baby_stations(announcement_payload("Nursery"));

        service.stop();

        expect(service.get_state().name).toBe("Stopped");
        expect(service.list_baby_stations().size).toBe(0);
        expect(mqtt_service.baby_stations_subscription.close).toHaveBeenCalledTimes(1);
        expect(mqtt_service.control_inbox_subscription.close).toHaveBeenCalledTimes(1);
        expect(mqtt_service.client_status_subscription.close).toHaveBeenCalledTimes(1);
    });

    test("stop twice is no-op", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);

        service.stop();
        service.stop();

        expect(mqtt_service.baby_stations_subscription.close).not.toHaveBeenCalled();
        expect(mqtt_service.control_inbox_subscription.close).not.toHaveBeenCalled();
        expect(mqtt_service.client_status_subscription.close).not.toHaveBeenCalled();
    });

    test("adds baby station announcement to list", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.start();

        mqtt_service.dispatch_baby_stations(announcement_payload("Nursery"));

        const baby_station = service.list_baby_stations().first();
        expect(baby_station).toEqual({
            client_id: "baby-client",
            session: {
                id: "session-1",
                name: "Nursery",
                started_at: 123,
            },
        });
    });

    test("adds control inbox announcement to list", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.start();

        mqtt_service.dispatch_control_inbox({
            type: "baby_station_announcement",
            baby_station_announcement: announcement("Nursery"),
        });

        expect(service.list_baby_stations().first()?.session.name).toBe("Nursery");
    });

    test("drops duplicate session id", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.start();

        mqtt_service.dispatch_baby_stations(announcement_payload("Original"));
        mqtt_service.dispatch_baby_stations(announcement_payload("Changed"));

        expect(service.list_baby_stations().size).toBe(1);
        expect(service.list_baby_stations().first()?.session.name).toBe("Original");
    });

    test("removes baby station on clean disconnect", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.start();
        mqtt_service.dispatch_baby_stations(announcement_payload("Nursery"));

        mqtt_service.dispatch_client_status("accounts/account-1/clients/baby-client/status", disconnected_payload("clean"));

        expect(service.list_baby_stations().size).toBe(0);
    });

    test("removes baby station on unexpected disconnect", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.start();
        mqtt_service.dispatch_baby_stations(announcement_payload("Nursery"));

        mqtt_service.dispatch_client_status("accounts/account-1/clients/baby-client/status", disconnected_payload("unexpected"));

        expect(service.list_baby_stations().size).toBe(0);
    });

    test("ignores malformed status topic", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.start();
        mqtt_service.dispatch_baby_stations(announcement_payload("Nursery"));

        mqtt_service.dispatch_client_status("accounts/account-1/clients/baby-client/webrtc_inbox", disconnected_payload("clean"));

        expect(service.list_baby_stations().size).toBe(1);
    });
});

const new_service = (mqtt_service = new MockMQTTService()): BabyStationListService => {
    return new BabyStationListService({
        logging_service: new ConsoleLoggingService(),
        mqtt_service: mqtt_service as any,
    });
};

const announcement_payload = (name: string): unknown => ({
    type: "announcement",
    at_millis: 123,
    announcement: announcement(name),
});

const announcement = (name: string): unknown => ({
    client_id: "baby-client",
    connection_id: "connection-1",
    session_id: "session-1",
    name,
    started_at_millis: 123,
});

const disconnected_payload = (reason: "clean" | "unexpected"): unknown => ({
    type: "disconnected",
    disconnected: {
        connection_id: "connection-1",
        request_id: "request-1",
        at_millis: 456,
        reason,
    },
});

class MockMQTTService {
    public readonly baby_stations_subscription = new MockSubscription("baby_stations");
    public readonly control_inbox_subscription = new MockSubscription("control_inbox");
    public readonly client_status_subscription = new MockSubscription("client_status");
    private baby_stations_handler: Optional<MessageHandler> = null;
    private control_inbox_handler: Optional<MessageHandler> = null;
    private client_status_handler: Optional<MessageHandler> = null;

    public subscribe_to_baby_stations = jest.fn((handler: MessageHandler): Subscription => {
        this.baby_stations_handler = handler;
        return this.baby_stations_subscription;
    });

    public subscribe_to_control_inbox = jest.fn((handler: MessageHandler): Subscription => {
        this.control_inbox_handler = handler;
        return this.control_inbox_subscription;
    });

    public subscribe_to_client_status = jest.fn((handler: MessageHandler): Subscription => {
        this.client_status_handler = handler;
        return this.client_status_subscription;
    });

    public dispatch_baby_stations = (payload: unknown): void => {
        if (this.baby_stations_handler === null) throw new Error("missing baby stations handler");
        this.baby_stations_handler(new MessageReceived("accounts/account-1/baby_stations", JSON.stringify(payload)));
    }

    public dispatch_control_inbox = (payload: unknown): void => {
        if (this.control_inbox_handler === null) throw new Error("missing control inbox handler");
        this.control_inbox_handler(new MessageReceived("accounts/account-1/clients/parent-client/control_inbox", JSON.stringify(payload)));
    }

    public dispatch_client_status = (topic: string, payload: unknown): void => {
        if (this.client_status_handler === null) throw new Error("missing client status handler");
        this.client_status_handler(new MessageReceived(topic, JSON.stringify(payload)));
    }
}

class MockSubscription implements Subscription {
    public readonly callback = jest.fn();
    public readonly test = jest.fn();
    public readonly close = jest.fn();

    constructor(public readonly topic_filter: string) { }
}
