import Service, { SetStateFunction } from "../../Service";
import LoggingService from '../../LoggingService';
import RTCConnection from "./Connection/RTCConnection";
import { InitiatedBy } from "./Connection";
import { Session } from "../types";
import WebSocketSignalService from "../../SignalService/WebSocketSignalService";

interface ServiceProxy {
    logging_service: LoggingService;
    signal_service: WebSocketSignalService;
    parent_station_media_stream: MediaStream;
    set_state: SetStateFunction<SessionState>;
}

type SessionExistsFunction = (session_id: string) => boolean;

abstract class AbstractState {
    public abstract name: string;
    public abstract get_active_session(): Session | null;
    public abstract get_active_connection(): RTCConnection | null;
    public abstract join_session(service: ServiceProxy, session: Session): void;
    public abstract leave_session(service: ServiceProxy): void;
    public abstract leave_session_if_ended(service: ServiceProxy, session_exists: SessionExistsFunction): void;
    public abstract reconnect_if_needed(service: ServiceProxy, session_exists: SessionExistsFunction): void;
}

class NotJoined extends AbstractState {
    public name = 'not_joined';

    public join_session(service: ServiceProxy, session: Session): void {
        const rtc_connection = new RTCConnection({
            logging_service: service.logging_service,
            signal_service: service.signal_service,
            parent_station_media_stream: service.parent_station_media_stream,
            session,
        });
        service.set_state(new Joined({
            session,
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

    public reconnect_if_needed(service: ServiceProxy, session_exists: SessionExistsFunction): void {
        // do nothing
    }
}

interface NewJoinedInput {
    session: Session;
    rtc_connection: RTCConnection;
}

class Joined extends AbstractState {
    public name = 'joined';
    public readonly session: Session;
    public readonly rtc_connection: RTCConnection;

    constructor(input: NewJoinedInput) {
        super();
        this.session = input.session;
        this.rtc_connection = input.rtc_connection;
    }

    public get_active_session(): Session | null {
        return this.session;
    }

    public get_active_connection(): RTCConnection | null {
        return this.rtc_connection;
    }

    // TODO should switch_session be an explicit method?
    public join_session = (service: ServiceProxy, session: Session): void => {
        if (this.session.id === session.id) return;
        this.rtc_connection.close(InitiatedBy.Client);
        const rtc_connection = new RTCConnection({
            logging_service: service.logging_service,
            signal_service: service.signal_service,
            parent_station_media_stream: service.parent_station_media_stream,
            session,
        });
        service.set_state(new Joined({
            session,
            rtc_connection: rtc_connection
        }));
    }

    public leave_session = (service: ServiceProxy): void => {
        this.rtc_connection.close(InitiatedBy.Client);
        service.set_state(new NotJoined());
    }

    public leave_session_if_ended = (service: ServiceProxy, session_exists: SessionExistsFunction): void => {
        if (session_exists(this.session.id)) return;
        this.leave_session(service);
    }

    // TODO move state checking into respective classes
    public reconnect_if_needed = (service: ServiceProxy, session_exists: SessionExistsFunction): void => {
        const rtc_connection_state = this.rtc_connection.get_state();
        if (rtc_connection_state.state !== "failed") return;
        const signal_state = service.signal_service.get_state();
        if (signal_state.name !== "connected") return;
        if (!session_exists(this.session.id)) return;
        this.rtc_connection.reconnect();
    }
}

export type SessionState = NotJoined | Joined;

interface NewSessionServiceInput {
    logging_service: LoggingService;
    signal_service: WebSocketSignalService;
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
            signal_service: input.signal_service,
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

    public join_session = (session: Session) => {
        const state = this.get_state();
        state.join_session(this.proxy, session);
    }

    public leave_session = () => {
        const state = this.get_state();
        state.leave_session(this.proxy);
    }

    public leave_session_if_ended = (session_exists: SessionExistsFunction) => {
        const state = this.get_state();
        state.leave_session_if_ended(this.proxy, session_exists);
    }

    public reconnect_if_needed = (session_exists: SessionExistsFunction) => {
        const state = this.get_state();
        state.reconnect_if_needed(this.proxy, session_exists);
    }
}

export default SessionService;
