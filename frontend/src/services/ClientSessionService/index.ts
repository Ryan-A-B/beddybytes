import Severity from "../LoggingService/Severity";
import ProjectedSessionList, { EventTypeSessionListChanged } from "../SessionListService";
import RTCConnection from "./RTCConnection";

export const EventTypeClientSessionStateChanged = 'client_session_status_changed';

interface NewClientSessionServiceInput {
    logging_service: LoggingService;
    signal_service: SignalService;
    session_list_service: ProjectedSessionList;
}

class ClientSessionService extends EventTarget {
    private logging_service: LoggingService;
    private signal_service: SignalService;
    private session_list_service: ProjectedSessionList;
    private state: ClientSessionState = { state: 'not_joined' };

    constructor(input: NewClientSessionServiceInput) {
        super();
        this.logging_service = input.logging_service;
        this.signal_service = input.signal_service;
        this.session_list_service = input.session_list_service;
        this.session_list_service.addEventListener(EventTypeSessionListChanged, this.handle_session_list_changed);
    }

    public get_status = (): ClientSessionState => {
        return this.state;
    }

    private set_status = (client_session_state: ClientSessionState): void => {
        this.logging_service.log({
            severity: Severity.Informational,
            message: `client session status changed from ${this.state.state} to ${client_session_state.state}`,
        })
        this.state = client_session_state;
        this.dispatchEvent(new Event(EventTypeClientSessionStateChanged));
    }

    public join_session(session: Session) {
        if (this.state.state === 'joining') throw new Error('Already joining');
        if (this.state.state === 'joined') throw new Error('Already joined');
        const rtc_connection = new RTCConnection({
            logging_service: this.logging_service,
            signal_service: this.signal_service,
            session,
        });
        this.set_status({ state: 'joined', session, client_connection: rtc_connection });
    }

    public leave_session() {
        this.leave_session_with_state({ state: 'left' });
    }

    private leave_session_with_state = (state: ClientSessionState) => {
        if (this.state.state !== 'joined')
            return;
        const rtc_connection = this.state.client_connection;
        rtc_connection.close(false);
        this.set_status(state);
    }

    private handle_session_list_changed = () => {
        if (this.state.state !== 'joined')
            return;
        const session = this.state.session;
        const session_list = this.session_list_service.get_session_list();
        const session_gone = session_list.find((s) => s.id === session.id) === undefined;
        if (session_gone)
            return this.leave_session_with_state({ state: 'session_ended' });
    }
}

export default ClientSessionService;
