const mock_rtc_connections: any[] = [];

jest.mock("./SessionService/Connection/RTCConnection", () => {
    return function MockRTCConnection(input: any) {
        const connection = {
            input,
            close: jest.fn(),
            reconnect: jest.fn(),
            get_state: jest.fn(() => ({ state: "new" })),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        };
        mock_rtc_connections.push(connection);
        return connection;
    };
});

import ParentStation from ".";
import LoggingService, { LogInput } from "../LoggingService";
import { MessageHandler, Subscription } from "../MQTTService";
import { ServiceStateChangedEvent } from "../Service";

describe("ParentStation", () => {
    let performance_now_spy: jest.SpyInstance<number, []>;

    beforeEach(() => {
        mock_rtc_connections.length = 0;
        (global as any).MediaStream = MockMediaStream;
        set_visibility_state("visible");
        performance_now_spy = jest.spyOn(performance, "now").mockReturnValue(1000);
    });

    afterEach(() => {
        performance_now_spy.mockRestore();
    });

    test("restores session service connection after MQTT reconnects during recent foreground return", () => {
        const mqtt_service = new MockMQTTService();
        const parent_station = new_parent_station(mqtt_service);
        parent_station.session_service.join_session(baby_station());

        set_recent_visibility_change(parent_station, 1000);
        performance_now_spy.mockReturnValue(1500);
        mqtt_service.dispatch_state_change("OfflineAndReconnecting", "Connected");

        expect(mock_rtc_connections[0].reconnect).toHaveBeenCalledTimes(1);
    });

    test("start connects MQTT without publishing parent station announcement immediately", () => {
        const mqtt_service = new MockMQTTService();
        const parent_station = new_parent_station(mqtt_service);

        parent_station.start();

        expect(mqtt_service.connect).toHaveBeenCalledTimes(1);
        expect(mqtt_service.publish_parent_station_announcement).not.toHaveBeenCalled();
    });

    test("publishes parent station announcement when MQTT connects", () => {
        const mqtt_service = new MockMQTTService();
        new_parent_station(mqtt_service);

        mqtt_service.dispatch_state_change("Connecting", "Connected");

        expect(mqtt_service.publish_parent_station_announcement).toHaveBeenCalledTimes(1);
    });

    test("publishes parent station announcement when MQTT reconnects", () => {
        const mqtt_service = new MockMQTTService();
        new_parent_station(mqtt_service);

        mqtt_service.dispatch_state_change("OfflineAndReconnecting", "Connected");

        expect(mqtt_service.publish_parent_station_announcement).toHaveBeenCalledTimes(1);
    });

    test("does not restore session service connection when foreground return is stale", () => {
        const mqtt_service = new MockMQTTService();
        const parent_station = new_parent_station(mqtt_service);
        parent_station.session_service.join_session(baby_station());

        set_recent_visibility_change(parent_station, 1000);
        performance_now_spy.mockReturnValue(4001);
        mqtt_service.dispatch_state_change("OfflineAndReconnecting", "Connected");

        expect(mock_rtc_connections[0].reconnect).not.toHaveBeenCalled();
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
    public client_status_handler: MessageHandler | null = null;

    connect = jest.fn();
    disconnect = jest.fn();
    publish_parent_station_announcement = jest.fn();
    publish_control_inbox = jest.fn();
    get_state = jest.fn(() => ({ name: "Connected" }));

    subscribe_to_client_status = jest.fn((client_id: string, handler: MessageHandler): Subscription => {
        this.client_status_handler = handler;
        return new MockSubscription(`clients/${client_id}/status`);
    });

    subscribe_to_all_client_statuses = jest.fn((handler: MessageHandler): Subscription => {
        return new MockSubscription("clients/+/status");
    });

    subscribe_to_control_inbox = jest.fn((handler: MessageHandler): Subscription => {
        return new MockSubscription("clients/parent-client/control_inbox");
    });

    subscribe_to_baby_stations = jest.fn((handler: MessageHandler): Subscription => {
        return new MockSubscription("baby_stations");
    });

    dispatch_state_change = (previous_state_name: string, current_state_name: string): void => {
        this.dispatchEvent(new ServiceStateChangedEvent(
            new MockMQTTState(previous_state_name),
            new MockMQTTState(current_state_name),
        ));
    }
}

class MockMQTTState {
    constructor(public readonly name: string) { }

    toString = (): string => {
        return this.name;
    }
}

class MockSubscription implements Subscription {
    public readonly callback = jest.fn();
    public readonly test = jest.fn();
    public readonly close = jest.fn();

    constructor(public readonly topic_filter: string) { }
}

class MockMediaStream extends EventTarget {
    getAudioTracks = jest.fn(() => []);
    getVideoTracks = jest.fn(() => []);
}

class MockWakeLockService {
    lock = jest.fn();
    unlock = jest.fn();
    get_state = jest.fn(() => ({ name: "locked" }));
}

const new_parent_station = (mqtt_service: MockMQTTService): ParentStation => {
    return new ParentStation({
        logging_service: new MockLoggingService(),
        authorization_service: {} as any,
        mqtt_service: mqtt_service as any,
        wake_lock_service: new MockWakeLockService() as any,
    });
};

const baby_station = () => ({
    client_id: "baby-client",
    session: {
        id: "session-1",
        name: "Nursery",
        started_at: 123,
    },
});

const set_visibility_state = (visibility_state: DocumentVisibilityState): void => {
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: visibility_state,
    });
};

const set_recent_visibility_change = (parent_station: ParentStation, timestamp_millis: number): void => {
    (parent_station as any).last_visibilitychange_details = {
        timestamp_millis,
        visibility_state: "visible",
    };
};
