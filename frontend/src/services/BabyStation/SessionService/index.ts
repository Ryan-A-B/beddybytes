import { v4 as uuid } from "uuid";
import Service from "../../Service";
import { ServiceStateChangedEvent } from "../../Service";
import LoggingService from "../../LoggingService";
import { MessageReceived, MQTTServiceState } from "../../MQTTService";
import { babyStationsTopic, clientControlInboxTopic, parentStationsTopic } from "../../MQTTService/topics";
import {
    newBabyStationAnnouncementPayload,
    newBabyStationControlAnnouncementPayload,
    ParentStationAnnouncement,
    SessionAnnouncement,
} from "../../MQTTService/payloads";
import settings from "../../../settings";

export type SessionState = Ready | SessionStarting | SessionRunning;

interface ServiceProxy {
    mqtt_service: MQTTService;
    set_state(state: SessionState): void;
}

interface MQTTService extends EventTarget {
    connect(): void;
    disconnect(): void;
    subscribe(topicFilter: string): void;
    publish(topic: string, payload: string): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface StartSessionInput {
    name: string;
}

abstract class AbstractState {
    public abstract readonly name: string;

    public start_session(proxy: ServiceProxy, input: StartSessionInput): void {
        // Default is to ignore start requests.
    }

    public handle_mqtt_service_state_changed(proxy: ServiceProxy, event: ServiceStateChangedEvent<MQTTServiceState>): void {
        // Default is to ignore MQTT state changes.
    }

    public end_session(proxy: ServiceProxy): void {
        // Default is to ignore end requests.
    }

    public handle_parent_station_announcement(proxy: ServiceProxy, announcement: ParentStationAnnouncement): void {
        // Default is to ignore parent station announcements.
    }
}

class Ready extends AbstractState {
    public readonly name = "Ready";

    public start_session(proxy: ServiceProxy, input: StartSessionInput): void {
        proxy.mqtt_service.connect();
        proxy.set_state(new SessionStarting(input.name));
    }
}

class SessionStarting extends AbstractState {
    public readonly name = "SessionStarting";
    private readonly stationName: string;

    constructor(name: string) {
        super();
        this.stationName = name;
    }

    public handle_mqtt_service_state_changed(proxy: ServiceProxy, event: ServiceStateChangedEvent<MQTTServiceState>): void {
        if (event.current_state.name !== "Connected") return;
        const connected = event.current_state;
        const startedAtMillis = Date.now();
        const announcement: SessionAnnouncement = {
            client_id: settings.API.clientID,
            connection_id: connected.connection_id,
            session_id: uuid(),
            name: this.stationName,
            started_at_millis: startedAtMillis,
        };
        proxy.mqtt_service.subscribe(parentStationsTopic(connected.account_id));
        proxy.mqtt_service.publish(babyStationsTopic(connected.account_id), JSON.stringify(newBabyStationAnnouncementPayload(announcement)));
        proxy.set_state(new SessionRunning(connected.account_id, announcement));
    }
}

class SessionRunning extends AbstractState {
    public readonly name = "SessionRunning";
    public readonly announcement: SessionAnnouncement;
    private readonly accountID: string;

    constructor(accountID: string, announcement: SessionAnnouncement) {
        super();
        this.accountID = accountID;
        this.announcement = announcement;
    }

    public end_session(proxy: ServiceProxy): void {
        proxy.mqtt_service.disconnect();
        proxy.set_state(new Ready());
    }

    public handle_parent_station_announcement(proxy: ServiceProxy, announcement: ParentStationAnnouncement): void {
        proxy.mqtt_service.publish(
            clientControlInboxTopic(this.accountID, announcement.client_id),
            JSON.stringify(newBabyStationControlAnnouncementPayload(this.announcement, Date.now())),
        );
    }
}

interface NewSessionServiceInput {
    logging_service: LoggingService;
    mqtt_service: MQTTService;
}

class SessionService extends Service<SessionState> {
    protected readonly name = "BabyStationSessionService";
    private readonly proxy: ServiceProxy;

    constructor(input: NewSessionServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: new Ready(),
        });
        this.proxy = {
            mqtt_service: input.mqtt_service,
            set_state: this.set_state,
        };
        input.mqtt_service.addEventListener("state_changed", this.handle_mqtt_service_state_changed as EventListener);
        input.mqtt_service.addEventListener("message_received", this.handle_message as EventListener);
    }

    protected to_string = (state: SessionState): string => {
        return state.name;
    }

    public start_session = (input: StartSessionInput): void => {
        this.get_state().start_session(this.proxy, input);
    }

    public end_session = (): void => {
        this.get_state().end_session(this.proxy);
    }

    private handle_mqtt_service_state_changed = (event: ServiceStateChangedEvent<MQTTServiceState>): void => {
        this.get_state().handle_mqtt_service_state_changed(this.proxy, event);
    }

    private handle_message = (event: MessageReceived): void => {
        const announcement = parse_parent_station_announcement(event.topic, event.payload);
        if (announcement === null) return;
        this.get_state().handle_parent_station_announcement(this.proxy, announcement);
    }
}

export default SessionService;

const parse_parent_station_announcement = (topic: string, payload: string): ParentStationAnnouncement | null => {
    if (!topic.endsWith("/parent_stations")) return null;
    const parsed = JSON.parse(payload);
    if (parsed.type !== "announcement") return null;
    return parsed.announcement;
};
