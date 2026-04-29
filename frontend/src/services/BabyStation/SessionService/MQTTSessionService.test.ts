import MQTTSessionService from "./MQTTSessionService";
import ConsoleLoggingService from "../../LoggingService/ConsoleLoggingService";

describe("MQTTSessionService", () => {
    test("start connects MQTT and publishes baby station announcement", async () => {
        const mqtt_service = new MockMQTTService();
        const service = new MQTTSessionService({
            logging_service: new ConsoleLoggingService(),
            // @ts-ignore
            mqtt_service,
            uuid: () => "session-1",
            now: () => 123,
        });

        await service.start_session({ name: "Nursery" });

        expect(mqtt_service.start).toHaveBeenCalledTimes(1);
        expect(mqtt_service.published_baby_station_announcements).toEqual([
            {
                type: "announcement",
                at_millis: 123,
                announcement: {
                    client_id: "baby-client",
                    connection_id: "connection-1",
                    session_id: "session-1",
                    name: "Nursery",
                    started_at_millis: 123,
                },
            },
        ]);
        expect(service.get_state().name).toBe("session_running");
    });

    test("responds to parent station announcements while running", async () => {
        const mqtt_service = new MockMQTTService();
        const service = new MQTTSessionService({
            logging_service: new ConsoleLoggingService(),
            // @ts-ignore
            mqtt_service,
            uuid: () => "session-1",
            now: () => 123,
        });
        await service.start_session({ name: "Nursery" });

        mqtt_service.dispatch_parent_station_announcement("parent-client");

        expect(mqtt_service.published_control).toEqual([
            {
                targetClientID: "parent-client",
                payload: {
                    type: "baby_station_announcement",
                    at_millis: 123,
                    baby_station_announcement: {
                        client_id: "baby-client",
                        connection_id: "connection-1",
                        session_id: "session-1",
                        name: "Nursery",
                        started_at_millis: 123,
                    },
                },
            },
        ]);
    });

    test("end stops MQTT to send clean disconnect", async () => {
        const mqtt_service = new MockMQTTService();
        const service = new MQTTSessionService({
            logging_service: new ConsoleLoggingService(),
            // @ts-ignore
            mqtt_service,
            uuid: () => "session-1",
            now: () => 123,
        });
        await service.start_session({ name: "Nursery" });

        await service.end_session();

        expect(mqtt_service.stop).toHaveBeenCalledTimes(1);
        expect(service.get_state().name).toBe("no_session_running");
    });
});

class MockMQTTService extends EventTarget {
    public readonly published_baby_station_announcements: unknown[] = [];
    public readonly published_control: unknown[] = [];

    start = jest.fn(async () => undefined);
    stop = jest.fn(async () => undefined);

    get_state = jest.fn(() => ({
        name: "connected",
        account_id: "account-1",
        client_id: "baby-client",
        connection_id: "connection-1",
        request_id: "request-1",
    }));

    publish_baby_station_announcement = jest.fn(async (payload: unknown) => {
        this.published_baby_station_announcements.push(payload);
    });

    publish_control = jest.fn(async (targetClientID: string, payload: unknown) => {
        this.published_control.push({ targetClientID, payload });
    });

    dispatch_parent_station_announcement(parentClientID: string): void {
        this.dispatchEvent(new MockParentStationsEvent({
            type: "announcement",
            at_millis: 456,
            announcement: {
                client_id: parentClientID,
                connection_id: "parent-connection",
            },
        }));
    }
}

class MockParentStationsEvent extends Event {
    public readonly payload: unknown;

    constructor(payload: unknown) {
        super("parent_stations");
        this.payload = payload;
    }
}
