import { v4 as uuid } from 'uuid';
import { Session } from '../SessionListService/types';
import Service from '../../Service';
import { SessionState } from '.';
import LoggingService from '../../LoggingService';
import Connection, { ConnectionState, InitiatedBy } from './Connection';

export const EventTypeClientSessionStatusChanged = 'client_session_status_changed';

const InitialState: SessionState = { state: 'not_joined' };

interface NewMockSessionServiceInput {
    logging_service: LoggingService;
}

class MockSessionService extends Service<SessionState> {
    protected readonly name = 'MockSessionService';

    constructor(input: NewMockSessionServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: InitialState,
        });
    }

    protected to_string = (state: SessionState): string => {
        return state.state;
    }

    public join_session(session: Session) {
        const state = this.get_state();
        if (state.state === 'joining') throw new Error('Already joining');
        if (state.state === 'joined') throw new Error('Already joined');
        const client_connection = new MockClientConnection({
            logging_service: this.logging_service,
        });
        this.set_state({ state: 'joined', session, connection: client_connection });
    }

    public leave_session() {
        this.leave_session_with_state({ state: 'left' });
    }

    private leave_session_with_state = (state: SessionState) => {
        const current_state = this.get_state();
        if (current_state.state !== 'joined')
            return;
        this.set_state(state);
    }
}

interface NewMockClientConnectionInput {
    logging_service: LoggingService;
}

class MockClientConnection extends Service<ConnectionState> implements Connection {
    protected readonly name = 'MockClientConnection';
    private static InitialState: ConnectionState = { state: 'connecting' };
    private media_stream: MediaStream = new MockMediaStream(uuid());

    constructor(input: NewMockClientConnectionInput) {
        super({
            logging_service: input.logging_service,
            initial_state: MockClientConnection.InitialState,
        })
    }

    protected to_string = (state: ConnectionState): string => {
        return state.state;
    }

    public get_rtc_peer_connection_state = (): RTCPeerConnectionState => {
        return 'connected';
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

export default MockSessionService;

class MockMediaStream extends EventTarget implements MediaStream {
    active: boolean;
    id: string;
    constructor(id: string) {
        super();
        this.active = true;
        this.id = id;
    }

    onaddtrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => any) | null = null;
    onremovetrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => any) | null = null;
    addTrack(track: MediaStreamTrack): void {

    }
    clone = () => {
        return new MockMediaStream(uuid());
    }
    getAudioTracks(): MediaStreamTrack[] {
        return [];
    }
    getTrackById(trackId: string): MediaStreamTrack | null {
        return null;
    }
    getTracks(): MediaStreamTrack[] {
        return [];
    }
    getVideoTracks(): MediaStreamTrack[] {
        return [];
    }
    removeTrack(track: MediaStreamTrack): void {

    }
}
