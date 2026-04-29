import { v4 as uuid } from "uuid";
import Service from "../../Service";
import LoggingService from "../../LoggingService";
import MQTTService, { ParentStationsEvent } from "../../OldMQTTService";
import { SessionAnnouncement } from "../../OldMQTTService/payloads";

export type SessionState = NoSessionRunning | SessionStarting | SessionRunning | SessionEnding;

interface NoSessionRunning {
    name: "no_session_running";
}

interface SessionStarting {
    name: "session_starting";
}

interface SessionRunning {
    name: "session_running";
    session_id: string;
    announcement: SessionAnnouncement;
}

interface SessionEnding {
    name: "session_ending";
}

interface NewSessionServiceInput {
    logging_service: LoggingService;
    mqtt_service: MQTTService;
    now?: () => number;
    uuid?: () => string;
}

interface StartSessionInput {
    name: string;
}

class MQTTSessionService extends Service<SessionState> {
    protected readonly name = "MQTTBabyStationSessionService";
    private readonly mqtt_service: MQTTService;
    private readonly now: () => number;
    private readonly uuid: () => string;

    constructor(input: NewSessionServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: { name: "no_session_running" },
        });
        this.mqtt_service = input.mqtt_service;
        this.now = input.now ?? Date.now;
        this.uuid = input.uuid ?? uuid;
        this.mqtt_service.addEventListener("parent_stations", this.handle_parent_station_announcement);
    }

    protected to_string(state: SessionState): string {
        return state.name;
    }

    public start_session = async (input: StartSessionInput): Promise<void> => {
        const state = this.get_state();
        if (state.name !== "no_session_running") throw new Error(`Cannot start session in ${state.name} state`);
        this.set_state({ name: "session_starting" });
        await this.mqtt_service.start();
        const mqttState = this.mqtt_service.get_state();
        if (mqttState.name !== "connected") throw new Error("MQTT service did not connect");
        const startedAtMillis = this.now();
        const announcement: SessionAnnouncement = {
            client_id: mqttState.client_id,
            connection_id: mqttState.connection_id,
            session_id: this.uuid(),
            name: input.name,
            started_at_millis: startedAtMillis,
        };
        await this.publish_baby_station_announcement(announcement);
        this.set_state({
            name: "session_running",
            session_id: announcement.session_id,
            announcement,
        });
    }

    public end_session = async (): Promise<void> => {
        const state = this.get_state();
        if (state.name !== "session_running") throw new Error(`Cannot end session in ${state.name} state`);
        this.set_state({ name: "session_ending" });
        await this.mqtt_service.stop();
        this.set_state({ name: "no_session_running" });
    }

    private handle_parent_station_announcement = (event: ParentStationsEvent): void => {
        const state = this.get_state();
        if (state.name !== "session_running") return;
        this.mqtt_service.publish_control(event.payload.announcement.client_id, {
            type: "baby_station_announcement",
            at_millis: this.now(),
            baby_station_announcement: state.announcement,
        });
    }

    private publish_baby_station_announcement = async (announcement: SessionAnnouncement): Promise<void> => {
        await this.mqtt_service.publish_baby_station_announcement({
            type: "announcement",
            at_millis: announcement.started_at_millis,
            announcement,
        });
    }
}

export default MQTTSessionService;
