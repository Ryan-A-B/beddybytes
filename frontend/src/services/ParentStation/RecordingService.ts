import moment from 'moment';
import Service, { EventTypeStateChanged, ServiceStateChangedEvent, SetStateFunction } from '../Service';
import LoggingService, { Severity } from '../LoggingService';
import SessionService, { SessionState } from './SessionService';
import { ConnectionState } from './SessionService/Connection';

const MediaRecorderTimeslice = 2000;
const DefaultMimeType = 'video/webm';

interface ServiceProxy {
    logging_service: LoggingService;
    session_service: SessionService;
    media_stream: MediaStream;
    get_state: () => RecordingServiceState;
    set_state: SetStateFunction<RecordingServiceState>;
    can_transition_to_ready: () => boolean;
}

interface RecordingServiceState {
    name: string;
    start: (service: ServiceProxy) => void;
    stop: (service: ServiceProxy) => void;
    handle_dataavailable: (service: ServiceProxy, event: BlobEvent) => void;
    handle_stop: (service: ServiceProxy) => void;
    handle_session_state_changed: (service: ServiceProxy, event: ServiceStateChangedEvent<SessionState>) => void;
    handle_connection_state_changed: (service: ServiceProxy, event: ServiceStateChangedEvent<ConnectionState>) => void;
    handle_media_stream_track_change: (service: ServiceProxy) => void;
}

class NotReady implements RecordingServiceState {
    public readonly name = 'not_ready';

    public start = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'Cannot start recording while not ready',
        });
    }

    public stop = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'Cannot stop recording when not recording',
        });
    }

    public handle_dataavailable = (service: ServiceProxy, event: BlobEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_dataavailable called in NotReady state',
        });
    }

    public handle_stop = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_stop called in NotReady state',
        });
    }

    public handle_session_state_changed = (service: ServiceProxy, event: ServiceStateChangedEvent<SessionState>) => {
        this.try_transition_to_ready(service);
    }

    public handle_connection_state_changed = (service: ServiceProxy, event: ServiceStateChangedEvent<ConnectionState>) => {
        this.try_transition_to_ready(service);
    }

    public handle_media_stream_track_change = (service: ServiceProxy) => {
        this.try_transition_to_ready(service);
    }

    private try_transition_to_ready = (service: ServiceProxy) => {
        if (!service.can_transition_to_ready()) return;
        service.set_state(new Ready());
    }
}

class Ready implements RecordingServiceState {
    public readonly name = 'ready';

    public start = (service: ServiceProxy) => {
        if (!service.can_transition_to_ready()) {
            service.set_state(new NotReady());
            service.logging_service.log({
                severity: Severity.Warning,
                message: 'Cannot start recording while not ready',
            });
            return;
        }

        try {
            const media_recorder = new MediaRecorder(service.media_stream);
            media_recorder.addEventListener('dataavailable', (event: BlobEvent) => {
                service.get_state().handle_dataavailable(service, event);
            });
            media_recorder.addEventListener('stop', () => {
                service.get_state().handle_stop(service);
            });
            media_recorder.start(MediaRecorderTimeslice);
            service.set_state(new Recording(media_recorder));
        } catch (error) {
            service.logging_service.log({
                severity: Severity.Warning,
                message: `Failed to start recording: ${error instanceof Error ? error.message : String(error)}`,
            });
            service.set_state(new NotReady());
        }
    }

    public stop = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'Cannot stop recording when not recording',
        });
    }

    public handle_dataavailable = (service: ServiceProxy, event: BlobEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_dataavailable called in Ready state',
        });
    }

    public handle_stop = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_stop called in Ready state',
        });
    }

    public handle_session_state_changed = (service: ServiceProxy, event: ServiceStateChangedEvent<SessionState>) => {
        this.transition_to_not_ready_if_needed(service);
    }

    public handle_connection_state_changed = (service: ServiceProxy, event: ServiceStateChangedEvent<ConnectionState>) => {
        this.transition_to_not_ready_if_needed(service);
    }

    public handle_media_stream_track_change = (service: ServiceProxy) => {
        this.transition_to_not_ready_if_needed(service);
    }

    private transition_to_not_ready_if_needed = (service: ServiceProxy) => {
        if (service.can_transition_to_ready()) return;
        service.set_state(new NotReady());
    }
}

class Recording implements RecordingServiceState {
    public readonly name = 'recording';
    private readonly media_recorder: MediaRecorder;
    private mime_type: Optional<string> = null;
    private readonly started_at = moment();
    private readonly chunks: Blob[] = [];

    constructor(media_recorder: MediaRecorder) {
        this.media_recorder = media_recorder;
    }

    public start = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'Already recording',
        });
    }

    public stop = (service: ServiceProxy) => {
        this.media_recorder.stop();
    }

    public handle_dataavailable = (service: ServiceProxy, event: BlobEvent) => {
        this.chunks.push(event.data);
        this.set_mime_type_if_not_set(event.data.type);
    }

    public handle_stop = (service: ServiceProxy) => {
        if (service.can_transition_to_ready()) service.set_state(new Ready());
        else service.set_state(new NotReady());

        const mime_type = this.mime_type || DefaultMimeType;
        const recording_blob = new Blob(this.chunks, { type: mime_type });
        const recording_url = URL.createObjectURL(recording_blob);
        const download_link_element = document.createElement('a');

        document.body.appendChild(download_link_element);
        download_link_element.style.display = 'none';
        download_link_element.href = recording_url;
        download_link_element.download = `BeddyBytes_${this.started_at.format('YYYYMMDD_HHmmss')}`;

        Promise.resolve().then(() => {
            download_link_element.click();
            document.body.removeChild(download_link_element);
        });
    }

    public handle_session_state_changed = (service: ServiceProxy, event: ServiceStateChangedEvent<SessionState>) => {
        // Recording state transitions through handle_stop once MediaRecorder stops.
    }

    public handle_connection_state_changed = (service: ServiceProxy, event: ServiceStateChangedEvent<ConnectionState>) => {
        // Recording state transitions through handle_stop once MediaRecorder stops.
    }

    public handle_media_stream_track_change = (service: ServiceProxy) => {
        // Recording state transitions through handle_stop once MediaRecorder stops.
    }

    private set_mime_type_if_not_set = (mime_type: string) => {
        if (this.mime_type !== null) return;
        if (mime_type === '') return;
        this.mime_type = mime_type;
    }
}

interface NewRecordingServiceInput {
    logging_service: LoggingService;
    session_service: SessionService;
    media_stream: MediaStream;
}

class RecordingService extends Service<RecordingServiceState> {
    protected readonly name = 'RecordingService';
    private readonly session_service: SessionService;
    private readonly media_stream: MediaStream;
    private readonly proxy: ServiceProxy;
    private remove_connection_event_listener: Optional<() => void> = null;

    constructor(input: NewRecordingServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: new NotReady(),
        });

        this.session_service = input.session_service;
        this.media_stream = input.media_stream;
        this.proxy = {
            logging_service: input.logging_service,
            session_service: input.session_service,
            media_stream: input.media_stream,
            get_state: this.get_state,
            set_state: this.set_state,
            can_transition_to_ready: this.can_transition_to_ready,
        };

        this.session_service.addEventListener(EventTypeStateChanged, this.handle_session_state_changed);
        this.media_stream.addEventListener('addtrack', this.handle_media_stream_track_change);
        this.media_stream.addEventListener('removetrack', this.handle_media_stream_track_change);

        this.sync_connection_event_listener(this.session_service.get_state());
        this.get_state().handle_media_stream_track_change(this.proxy);
    }

    protected to_string = (state: RecordingServiceState): string => {
        return state.name;
    }

    public start = (): void => {
        this.get_state().start(this.proxy);
    }

    public stop = (): void => {
        this.get_state().stop(this.proxy);
    }

    private handle_session_state_changed = (event: ServiceStateChangedEvent<SessionState>) => {
        this.sync_connection_event_listener(event.current_state);
        this.get_state().handle_session_state_changed(this.proxy, event);
    }

    private handle_connection_state_changed = (event: ServiceStateChangedEvent<ConnectionState>) => {
        this.get_state().handle_connection_state_changed(this.proxy, event);
    }

    private handle_media_stream_track_change = () => {
        this.get_state().handle_media_stream_track_change(this.proxy);
    }

    private sync_connection_event_listener = (session_state: SessionState) => {
        if (this.remove_connection_event_listener !== null) {
            this.remove_connection_event_listener();
            this.remove_connection_event_listener = null;
        }

        if (session_state.name !== 'joined') return;

        const active_connection = session_state.get_active_connection();
        if (active_connection === null) return;

        active_connection.addEventListener(EventTypeStateChanged, this.handle_connection_state_changed);
        this.remove_connection_event_listener = () => {
            active_connection.removeEventListener(EventTypeStateChanged, this.handle_connection_state_changed);
        };
    }

    private can_transition_to_ready = (): boolean => {
        if (typeof MediaRecorder === 'undefined') return false;

        const session_state = this.session_service.get_state();
        if (session_state.name !== 'joined') return false;

        const active_connection = session_state.get_active_connection();
        if (active_connection === null) return false;

        const live_video_tracks = this.media_stream.getVideoTracks().filter((track) => track.readyState === 'live');
        if (live_video_tracks.length === 0) return false;

        return true;
    }
}

export default RecordingService;
