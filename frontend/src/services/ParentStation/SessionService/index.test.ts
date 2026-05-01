const mock_rtc_connections: any[] = [];

jest.mock("./Connection/RTCConnection", () => {
    return function MockRTCConnection(input: any) {
        const connection = {
            input,
            close: jest.fn(),
            reconnect: jest.fn(),
            get_state: jest.fn(() => ({ state: "new" })),
        };
        mock_rtc_connections.push(connection);
        return connection;
    };
});

import SessionService from ".";
import LoggingService, { LogInput } from "../../LoggingService";
import { MessageHandler, MessageReceived, Subscription } from "../../MQTTService";
import { BabyStation } from "../types";

describe("ParentStation SessionService", () => {
    beforeEach(() => {
        mock_rtc_connections.length = 0;
    });

    test("subscribes to active baby station status when joining a session", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);

        service.join_session(baby_station("baby-client", "session-1"));

        expect(mqtt_service.subscribe_to_client_status).toHaveBeenCalledWith("baby-client", expect.any(Function));
        expect(mqtt_service.client_status_subscription.topic_filter).toBe("clients/baby-client/status");
    });

    test("clean disconnect from active baby station ends the session", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.join_session(baby_station("baby-client", "session-1"));

        mqtt_service.dispatch_client_status("baby-client", disconnected_payload("clean"));

        expect(service.get_state().name).toBe("not_joined");
        expect(mock_rtc_connections[0].close).toHaveBeenCalledTimes(1);
        expect(mqtt_service.client_status_subscription.close).toHaveBeenCalledTimes(1);
    });

    test("unexpected disconnect from active baby station does not end the session", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.join_session(baby_station("baby-client", "session-1"));

        mqtt_service.dispatch_client_status("baby-client", disconnected_payload("unexpected"));

        expect(service.get_state().name).toBe("joined");
        expect(mock_rtc_connections[0].close).not.toHaveBeenCalled();
        expect(mqtt_service.client_status_subscription.close).not.toHaveBeenCalled();
    });

    test("clean disconnect from another baby station does not end the session", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.join_session(baby_station("baby-client", "session-1"));

        mqtt_service.dispatch_client_status("other-client", disconnected_payload("clean"));

        expect(service.get_state().name).toBe("joined");
        expect(mock_rtc_connections[0].close).not.toHaveBeenCalled();
    });

    test("switching sessions closes previous client status subscription", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.join_session(baby_station("baby-client", "session-1"));
        const first_subscription = mqtt_service.client_status_subscription;

        service.join_session(baby_station("next-client", "session-2"));

        expect(first_subscription.close).toHaveBeenCalledTimes(1);
        expect(mqtt_service.subscribe_to_client_status).toHaveBeenLastCalledWith("next-client", expect.any(Function));
    });

    test("failed RTC connection reconnects when active session still exists", () => {
        const service = new_service(new MockMQTTService());
        service.join_session(baby_station("baby-client", "session-1"));
        mock_rtc_connections[0].get_state.mockReturnValue({ state: "failed" });

        service.reconnect_if_needed((session_id) => session_id === "session-1");

        expect(service.get_state().name).toBe("joined");
        expect(mock_rtc_connections[0].reconnect).toHaveBeenCalledTimes(1);
        expect(mock_rtc_connections[0].close).not.toHaveBeenCalled();
    });

    test("failed RTC connection does not leave when active session no longer exists", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.join_session(baby_station("baby-client", "session-1"));
        mock_rtc_connections[0].get_state.mockReturnValue({ state: "failed" });

        service.reconnect_if_needed(() => false);

        expect(service.get_state().name).toBe("joined");
        expect(mock_rtc_connections[0].reconnect).not.toHaveBeenCalled();
        expect(mock_rtc_connections[0].close).not.toHaveBeenCalled();
        expect(mqtt_service.client_status_subscription.close).not.toHaveBeenCalled();
    });

    test("disconnected RTC connection does not leave when active session no longer exists", () => {
        const mqtt_service = new MockMQTTService();
        const service = new_service(mqtt_service);
        service.join_session(baby_station("baby-client", "session-1"));
        mock_rtc_connections[0].get_state.mockReturnValue({ state: "disconnected" });

        service.reconnect_if_needed(() => false);

        expect(service.get_state().name).toBe("joined");
        expect(mock_rtc_connections[0].reconnect).not.toHaveBeenCalled();
        expect(mock_rtc_connections[0].close).not.toHaveBeenCalled();
        expect(mqtt_service.client_status_subscription.close).not.toHaveBeenCalled();
    });

    test("disconnected RTC connection does nothing when active session still exists", () => {
        const service = new_service(new MockMQTTService());
        service.join_session(baby_station("baby-client", "session-1"));
        mock_rtc_connections[0].get_state.mockReturnValue({ state: "disconnected" });

        service.reconnect_if_needed((session_id) => session_id === "session-1");

        expect(service.get_state().name).toBe("joined");
        expect(mock_rtc_connections[0].reconnect).not.toHaveBeenCalled();
        expect(mock_rtc_connections[0].close).not.toHaveBeenCalled();
    });
});

class MockLoggingService implements LoggingService {
    public readonly logs: LogInput[] = [];

    set_account_id = jest.fn();

    log = jest.fn((input: LogInput) => {
        this.logs.push(input);
    });
}

class MockMQTTService {
    public client_status_handler: MessageHandler | null = null;
    public client_status_subscription = new MockSubscription("");

    subscribe_to_client_status = jest.fn((client_id: string, handler: MessageHandler): Subscription => {
        this.client_status_handler = handler;
        this.client_status_subscription = new MockSubscription(`clients/${client_id}/status`);
        return this.client_status_subscription;
    });

    get_state = jest.fn(() => ({ name: "Connected" }));

    dispatch_client_status = (client_id: string, payload: unknown): void => {
        this.client_status_handler?.(new MessageReceived(
            `accounts/account-1/clients/${client_id}/status`,
            JSON.stringify(payload),
        ));
    }
}

class MockSubscription implements Subscription {
    public readonly callback = jest.fn();
    public readonly test = jest.fn();
    public readonly close = jest.fn();

    constructor(public readonly topic_filter: string) { }
}

const new_service = (mqtt_service: MockMQTTService): SessionService => {
    return new SessionService({
        logging_service: new MockLoggingService(),
        mqtt_service: mqtt_service as any,
        parent_station_media_stream: {} as MediaStream,
    });
};

const baby_station = (client_id: string, session_id: string): BabyStation => ({
    client_id,
    session: {
        id: session_id,
        name: "Nursery",
        started_at: 123,
    },
});

const disconnected_payload = (reason: "clean" | "unexpected"): unknown => ({
    type: "disconnected",
    disconnected: {
        reason,
    },
});
