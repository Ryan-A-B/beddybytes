import ConnectionService from "../ConnectionService";
import SessionListService, { EventTypeSessionListChanged, Session } from "../SessionListService";
import RTCConnection from "./RTCConnection";

export const EventTypeClientSessionStatusChanged = 'client_session_status_changed';

interface ClientSessionStatusNotJoined {
    status: 'not_joined';
}

interface ClientSessionStatusJoining {
    status: 'joining';
    session: Session;
}

interface ClientSessionStatusJoined {
    status: 'joined';
    session: Session;
    rtc_connection: RTCConnection;
}

interface ClientSessionStatusLeft {
    status: 'left';
}

interface ClientSessionStatusSessionEnded {
    status: 'session_ended';
}

export type ClientSessionStatus =
    ClientSessionStatusNotJoined |
    ClientSessionStatusJoining |
    ClientSessionStatusJoined |
    ClientSessionStatusLeft |
    ClientSessionStatusSessionEnded;

interface NewClientSessionServiceInput {
    connection_service: ConnectionService;
    session_list_service: SessionListService;
}

class ClientSessionService extends EventTarget {
    private connection_service: ConnectionService;
    private session_list_service: SessionListService;
    private status: ClientSessionStatus = { status: 'not_joined' };

    constructor(input: NewClientSessionServiceInput) {
        super();
        this.connection_service = input.connection_service;
        this.session_list_service = input.session_list_service;
        this.session_list_service.addEventListener(EventTypeSessionListChanged, this.handle_session_list_changed);
    }

    public get_status = (): ClientSessionStatus => {
        return this.status;
    }

    private set_status = (client_session_status: ClientSessionStatus): void => {
        this.status = client_session_status;
        this.dispatchEvent(new Event(EventTypeClientSessionStatusChanged));
    }

    public join_session(session: Session) {
        if (this.status.status === 'joining') throw new Error('Already joining');
        if (this.status.status === 'joined') throw new Error('Already joined');
        const connection_service_status = this.connection_service.get_status();
        if (connection_service_status.status !== 'connected')
            return;
        this.set_status({ status: 'joining', session });
        const connection = connection_service_status.connection;
        const rtc_connection = new RTCConnection(connection, session);
        this.set_status({ status: 'joined', session, rtc_connection });
    }

    public leave_session() {
        this.leave_session_with_status({ status: 'left' });
    }

    private leave_session_with_status = (status: ClientSessionStatus) => {
        if (this.status.status !== 'joined')
            return;
        const rtc_connection = this.status.rtc_connection;
        rtc_connection.close(false);
        this.set_status(status);
    }

    private handle_session_list_changed = () => {
        if (this.status.status !== 'joined')
            return;
        const session = this.status.session;
        const session_list = this.session_list_service.get_session_list();
        const session_in_list = session_list.find((s) => s.id === session.id);
        if (session_in_list === undefined)
            return this.leave_session_with_status({ status: 'session_ended' });
    }
}

export default ClientSessionService;
