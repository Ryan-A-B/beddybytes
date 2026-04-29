import Service, { SetStateFunction } from "../../Service";
import LoggingService from '../../LoggingService';
import RTCConnection from "./Connection/RTCConnection";
import { InitiatedBy } from "./Connection";
import { BabyStation, Session } from "../types";
import MQTTService from "../../MQTTService";

interface ServiceProxy {
    logging_service: LoggingService;
    mqtt_service: MQTTService;
    parent_station_media_stream: MediaStream;
    set_state: SetStateFunction<SessionState>;
}

type SessionExistsFunction = (session_id: string) => boolean;

abstract class AbstractState {
    public abstract name: string;
    public abstract get_active_session(): Session | null;
    public abstract get_active_connection(): RTCConnection | null;
    public abstract join_session(service: ServiceProxy, baby_station: BabyStation): void;
    public abstract leave_session(service: ServiceProxy): void;
    public abstract leave_session_if_ended(service: ServiceProxy, session_exists: SessionExistsFunction): void;
    public abstract reconnect(service: ServiceProxy): void;
    public abstract reconnect_if_needed(service: ServiceProxy, session_exists: SessionExistsFunction): void;
}

class NotJoined extends AbstractState {
    public name = 'not_joined';

    public join_session(service: ServiceProxy, baby_station: BabyStation): void {
        const rtc_connection = new RTCConnection({
            logging_service: service.logging_service,
            mqtt_service: service.mqtt_service,
            parent_station_media_stream: service.parent_station_media_stream,
            baby_station,
        });
        service.set_state(new Joined({
            baby_station,
            rtc_connection: rtc_connection
        }));
    }

    public get_active_session(): Session | null {
        return null;
    }

    public get_active_connection(): RTCConnection | null {
        return null;
    }

    public leave_session(service: ServiceProxy): void {
        // do nothing
    }

    public leave_session_if_ended(service: ServiceProxy, session_exists: SessionExistsFunction): void {
        // do nothing
    }

    public reconnect(service: ServiceProxy): void {
        // do nothing
    }

    public reconnect_if_needed(service: ServiceProxy, session_exists: SessionExistsFunction): void {
        // do nothing
    }
}

interface NewJoinedInput {
    baby_station: BabyStation;
    rtc_connection: RTCConnection;
}

class Joined extends AbstractState {
    public name = 'joined';
    public readonly baby_station: BabyStation;
    public readonly rtc_connection: RTCConnection;

    constructor(input: NewJoinedInput) {
        super();
        this.baby_station = input.baby_station;
        this.rtc_connection = input.rtc_connection;
    }

    public get_active_session(): Session | null {
        return this.baby_station.session;
    }

    public get_active_connection(): RTCConnection | null {
        return this.rtc_connection;
    }

    // TODO should switch_session be an explicit method?
    public join_session = (service: ServiceProxy, baby_station: BabyStation): void => {
        if (this.baby_station.session.id === baby_station.session.id) return;
        this.rtc_connection.close(InitiatedBy.Client);
        const rtc_connection = new RTCConnection({
            logging_service: service.logging_service,
            mqtt_service: service.mqtt_service,
            parent_station_media_stream: service.parent_station_media_stream,
            baby_station,
        });
        service.set_state(new Joined({
            baby_station,
            rtc_connection: rtc_connection
        }));
    }

    public leave_session = (service: ServiceProxy): void => {
        this.rtc_connection.close(InitiatedBy.Client);
        service.set_state(new NotJoined());
    }

    public leave_session_if_ended = (service: ServiceProxy, session_exists: SessionExistsFunction): void => {
        if (session_exists(this.baby_station.session.id)) return;
        this.leave_session(service);
    }

    public reconnect(service: ServiceProxy): void {
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
        };
    }

    protected to_string = (state: SessionState): string => {
        return state.name;
    }

    // TODO remove backdoor
    public get_active_session = (): Session | null => {
        const state = this.get_state();
        return state.get_active_session();
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
}

export default SessionService;
