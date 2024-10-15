import { List } from "immutable";
import LoggingService from '../../LoggingService';
import { InitiatedBy } from "./Connection/InitiatedBy";
import RTCConnection from "./Connection/RTCConnection";
import { EventTypeSessionListChanged, Session, SessionListService } from "../SessionListService/types";
import Service from "../../Service";

interface SessionStateNotJoined {
    state: 'not_joined';
}

interface SessionStateJoining {
    state: 'joining';
    session: Session;
}

interface SessionStateJoined {
    state: 'joined';
    session: Session;
    connection: Connection;
}

interface SessionStateLeft {
    state: 'left';
}

interface SessionStateSessionEnded {
    state: 'session_ended';
}

export type SessionState =
    SessionStateNotJoined |
    SessionStateJoining |
    SessionStateJoined |
    SessionStateLeft |
    SessionStateSessionEnded;

const InitialState: SessionState = { state: 'not_joined' };

interface NewSessionServiceInput {
    logging_service: LoggingService;
    signal_service: SignalService;
    session_list_service: SessionListService;
    parent_station_media_stream: MediaStream;
}

class SessionService extends Service<SessionState> {
    private signal_service: SignalService;
    private session_list_service: SessionListService;
    private parent_station_media_stream: MediaStream;

    constructor(input: NewSessionServiceInput) {
        super({
            logging_service: input.logging_service,
            to_string: (state: SessionState) => state.state,
            initial_state: InitialState,
        });
        this.signal_service = input.signal_service;
        this.session_list_service = input.session_list_service;
        this.session_list_service.addEventListener(EventTypeSessionListChanged, this.handle_session_list_changed);
        this.parent_station_media_stream = input.parent_station_media_stream;
    }

    public join_session(session: Session) {
        const state = this.get_state();
        if (state.state === 'joining') throw new Error('Already joining');
        if (state.state === 'joined') throw new Error('Already joined');
        const rtc_connection = new RTCConnection({
            logging_service: this.logging_service,
            signal_service: this.signal_service,
            session,
            parent_station_media_stream: this.parent_station_media_stream,
        });
        this.set_state({ state: 'joined', session, connection: rtc_connection });
    }

    public leave_session() {
        this.leave_session_with_state({ state: 'left' });
    }

    private leave_session_with_state = (state: SessionState) => {
        const current_state = this.get_state();
        if (current_state.state !== 'joined')
            return;
        const rtc_connection = current_state.connection;
        rtc_connection.close(InitiatedBy.Client);
        this.set_state(state);
    }

    private handle_session_list_changed = () => {
        const state = this.get_state();
        if (state.state !== 'joined')
            return;
        const session = state.session;
        const session_list = this.session_list_service.get_session_list();
        // TODO List in types.d.ts
        const session_gone = (session_list as List<Session>).find((s) => s.id === session.id) === undefined;
        if (session_gone)
            return this.leave_session_with_state({ state: 'session_ended' });
    }
}

export default SessionService;
