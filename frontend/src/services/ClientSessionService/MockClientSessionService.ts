import { Session } from "../SessionListService/types";
import ClientConnection, { MediaStreamState } from "./ClientConnection";
import ClientSessionService, { ClientSessionState } from "./ClientSessionService";
import { InitiatedBy } from "./InitiatedBy";

export const EventTypeClientSessionStatusChanged = 'client_session_status_changed';

class MockClientSessionService extends EventTarget implements ClientSessionService {
    private state: ClientSessionState = { state: 'not_joined' };

    public get_state = (): ClientSessionState => {
        return this.state;
    }

    private set_status = (client_session_state: ClientSessionState): void => {
        this.state = client_session_state;
        this.dispatchEvent(new Event(EventTypeClientSessionStatusChanged));
    }

    public join_session(session: Session) {
        if (this.state.state === 'joining') throw new Error('Already joining');
        if (this.state.state === 'joined') throw new Error('Already joined');
        const client_connection = new MockClientConnection();
        this.set_status({ state: 'joined', session, client_connection });
    }

    public leave_session() {
        this.leave_session_with_state({ state: 'left' });
    }

    private leave_session_with_state = (state: ClientSessionState) => {
        if (this.state.state !== 'joined')
            return;
        this.set_status(state);
    }
}

class MockClientConnection extends EventTarget implements ClientConnection {
    private media_stream: MediaStream = new MediaStream();

    public get_rtc_peer_connection_state = (): RTCPeerConnectionState => {
        return 'connected';
    }

    public get_media_stream_state = (): MediaStreamState => {
        return { state: 'available', media_stream: this.media_stream };
    }

    reconnect() {
        this.media_stream.getTracks().forEach(track => track.stop());
        this.media_stream = new MediaStream();
        return;
    }

    close(initiatedBy: InitiatedBy) {
        this.media_stream.getTracks().forEach(track => track.stop());
        return;
    }
}

export default MockClientSessionService;