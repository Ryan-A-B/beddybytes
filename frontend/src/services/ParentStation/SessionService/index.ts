import Service, { SetStateFunction } from "../../Service";
import LoggingService from '../../LoggingService';
import RTCConnection from "./Connection/RTCConnection";
import { InitiatedBy } from "./Connection";
import { BabyStation, Session } from "../types";
import MQTTService, { MessageReceived, Subscription } from "../../MQTTService";
import { parse_client_status_topic } from "../../MQTTService/topics";

interface ServiceProxy {
    logging_service: LoggingService;
    mqtt_service: MQTTService;
    parent_station_media_stream: MediaStream;
    set_state: SetStateFunction<SessionState>;
    handle_client_status(message: MessageReceived): void;
}

type SessionExistsFunction = (session_id: string) => boolean;

abstract class AbstractState {
    public abstract name: string;
    public abstract get_baby_station(): BabyStation | null;
    public abstract get_active_connection(): RTCConnection | null;
    public abstract join_session(service: ServiceProxy, baby_station: BabyStation): void;
    public abstract leave_session(service: ServiceProxy): void;
    public abstract leave_session_if_ended(service: ServiceProxy, session_exists: SessionExistsFunction): void;
    public abstract reconnect(service: ServiceProxy): void;
    public abstract reconnect_if_needed(service: ServiceProxy, session_exists: SessionExistsFunction): void;
    public abstract handle_client_status(service: ServiceProxy, message: MessageReceived): void;
}

class NotJoined extends AbstractState {
    public name = 'not_joined';

    public join_session = (service: ServiceProxy, baby_station: BabyStation): void => {
        const rtc_connection = new RTCConnection({
            logging_service: service.logging_service,
            mqtt_service: service.mqtt_service,
            parent_station_media_stream: service.parent_station_media_stream,
            baby_station,
        });
        const client_status_subscription = service.mqtt_service.subscribe_to_client_status(baby_station.client_id, service.handle_client_status);
        service.set_state(new Joined({
            baby_station,
            rtc_connection: rtc_connection,
            client_status_subscription,
        }));
    }

    public get_baby_station = (): BabyStation | null => {
        return null;
    }

    public get_active_connection = (): RTCConnection | null => {
        return null;
    }

    public leave_session = (service: ServiceProxy): void => {
        // do nothing
    }

    public leave_session_if_ended = (service: ServiceProxy, session_exists: SessionExistsFunction): void => {
        // do nothing
    }

    public reconnect = (service: ServiceProxy): void => {
        // do nothing
    }

    public reconnect_if_needed = (service: ServiceProxy, session_exists: SessionExistsFunction): void => {
        // do nothing
    }

    public handle_client_status = (service: ServiceProxy, message: MessageReceived): void => {
        // do nothing
    }
}

interface NewJoinedInput {
    baby_station: BabyStation;
    rtc_connection: RTCConnection;
    client_status_subscription: Subscription;
}

class Joined extends AbstractState {
    public name = 'joined';
    public readonly baby_station: BabyStation;
    public readonly rtc_connection: RTCConnection;
    private readonly client_status_subscription: Subscription;

    constructor(input: NewJoinedInput) {
        super();
        this.baby_station = input.baby_station;
        this.rtc_connection = input.rtc_connection;
        this.client_status_subscription = input.client_status_subscription;
    }

    public get_baby_station = (): BabyStation | null => {
        return this.baby_station;
    }

    public get_active_connection = (): RTCConnection | null => {
        return this.rtc_connection;
    }

    // TODO should switch_session be an explicit method?
    public join_session = (service: ServiceProxy, baby_station: BabyStation): void => {
        if (this.baby_station.session.id === baby_station.session.id) return;
        this.rtc_connection.close(InitiatedBy.Client);
        this.client_status_subscription.close();
        const rtc_connection = new RTCConnection({
            logging_service: service.logging_service,
            mqtt_service: service.mqtt_service,
            parent_station_media_stream: service.parent_station_media_stream,
            baby_station,
        });
        const client_status_subscription = service.mqtt_service.subscribe_to_client_status(baby_station.client_id, service.handle_client_status);
        service.set_state(new Joined({
            baby_station,
            rtc_connection: rtc_connection,
            client_status_subscription,
        }));
    }

    public leave_session = (service: ServiceProxy): void => {
        this.rtc_connection.close(InitiatedBy.Client);
        this.client_status_subscription.close();
        service.set_state(new NotJoined());
    }

    public leave_session_if_ended = (service: ServiceProxy, session_exists: SessionExistsFunction): void => {
        if (session_exists(this.baby_station.session.id)) return;
        this.leave_session(service);
    }

    public reconnect = (service: ServiceProxy): void => {
        this.rtc_connection.reconnect();
    }

    // TODO move state checking into respective classes
    public reconnect_if_needed = (service: ServiceProxy, session_exists: SessionExistsFunction): void => {
        const rtc_connection_state = this.rtc_connection.get_state();
        if (rtc_connection_state.state !== "failed") return;
        if (service.mqtt_service.get_state().name !== "Connected") return;
        if (!session_exists(this.baby_station.session.id)) return;
        this.rtc_connection.reconnect();
    }

    public handle_client_status = (service: ServiceProxy, message: MessageReceived): void => {
        const topic = parse_client_status_topic(message.topic);
        if (topic === null) return;
        if (topic.client_id !== this.baby_station.client_id) return;
        const payload = JSON.parse(message.payload) as ClientStatusPayload;
        if (payload.type !== "disconnected") return;
        if (payload.disconnected.reason !== "clean") return;
        this.leave_session(service);
    }
}

export type SessionState = NotJoined | Joined;

interface NewSessionServiceInput {
    logging_service: LoggingService;
    mqtt_service: MQTTService;
    parent_station_media_stream: MediaStream;
}

class SessionService extends Service<SessionState> {
    protected readonly name = 'SessionService';
    private readonly proxy: ServiceProxy;

    constructor(input: NewSessionServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: new NotJoined(),
        });
        this.proxy = {
            logging_service: input.logging_service,
            mqtt_service: input.mqtt_service,
            parent_station_media_stream: input.parent_station_media_stream,
            set_state: this.set_state,
            handle_client_status: this.handle_client_status,
        };
    }

    protected to_string = (state: SessionState): string => {
        return state.name;
    }

    // TODO remove backdoor
    public get_active_session = (): Session | null => {
        return this.get_baby_station()?.session ?? null;
    }

    public get_baby_station = (): BabyStation | null => {
        const state = this.get_state();
        return state.get_baby_station();
    }

    // TODO remove backdoor
    public get_active_connection = (): RTCConnection | null => {
        const state = this.get_state();
        return state.get_active_connection();
    }

    public join_session = (baby_station: BabyStation) => {
        const state = this.get_state();
        state.join_session(this.proxy, baby_station);
    }

    public leave_session = () => {
        const state = this.get_state();
        state.leave_session(this.proxy);
    }

    public leave_session_if_ended = (session_exists: SessionExistsFunction) => {
        const state = this.get_state();
        state.leave_session_if_ended(this.proxy, session_exists);
    }

    public reconnect = () => {
        this.get_state().reconnect(this.proxy);
    }

    public reconnect_if_needed = (session_exists: SessionExistsFunction) => {
        const state = this.get_state();
        state.reconnect_if_needed(this.proxy, session_exists);
    }

    private handle_client_status = (message: MessageReceived): void => {
        this.get_state().handle_client_status(this.proxy, message);
    }
}

export default SessionService;

interface ClientStatusPayload {
    type: "connected" | "disconnected";
    disconnected: {
        reason: "clean" | "unexpected";
    };
}
