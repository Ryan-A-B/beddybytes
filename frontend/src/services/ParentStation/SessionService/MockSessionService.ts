import { v4 as uuid } from 'uuid';
import { InitiatedBy } from "./Connection/InitiatedBy";

export const EventTypeClientSessionStatusChanged = 'client_session_status_changed';

class MockSessionService extends EventTarget implements ParentStationSessionService {
    private state: ParentStationSessionState = { state: 'not_joined' };

    public get_state = (): ParentStationSessionState => {
        return this.state;
    }

    private set_status = (client_session_state: ParentStationSessionState): void => {
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

    private leave_session_with_state = (state: ParentStationSessionState) => {
        if (this.state.state !== 'joined')
            return;
        this.set_status(state);
    }
}

class MockClientConnection extends EventTarget implements Connection {
    private media_stream: MediaStream = new MockMediaStream(uuid());

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
