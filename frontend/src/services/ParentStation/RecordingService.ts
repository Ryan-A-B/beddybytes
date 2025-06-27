import moment from 'moment';
import Service, { SetStateFunction } from '../Service';
import LoggingService, { Severity } from '../LoggingService';
import SessionService from './SessionService';

const EventTypeRecorderStopped = 'stopped';
const MediaRecorderTimeslice = 2000;
const DefaultMimeType = 'video/webm';

interface ServiceProxy {
    logging_service: LoggingService;
    session_service: SessionService;
    media_stream: MediaStream;
    get_state: () => RecordingServiceState;
    set_state: SetStateFunction<RecordingServiceState>;
}

interface RecordingServiceState {
    name: string;
    start: (service: ServiceProxy) => void;
    stop: (service: ServiceProxy) => void;
    handle_dataavailable: (service: ServiceProxy, event: BlobEvent) => void;
    handle_stop: (service: ServiceProxy) => void;
}

class NotRecording implements RecordingServiceState {
    public readonly name = 'not_recording';

    start = (service: ServiceProxy) => {
        const session_state = service.session_service.get_state();
        if (session_state.name !== 'joined')
            throw new Error('Cannot start recording when not joined to a session');

        const media_recorder = new MediaRecorder(service.media_stream);
        media_recorder.addEventListener('dataavailable', (event: BlobEvent) => {
            service.get_state().handle_dataavailable(service, event);
        });
        media_recorder.addEventListener('stop', () => {
            service.get_state().handle_stop(service);
        });
        media_recorder.start(MediaRecorderTimeslice);
        service.set_state(new Recording(media_recorder));
    }

    stop = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'Cannot stop recording when not recording',
        })
    }

    handle_dataavailable = (service: ServiceProxy, event: BlobEvent) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_dataavailable called in NotRecording state',
        });
    }

    handle_stop = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'handle_stop called in NotRecording state',
        });
    }
}

class Recording implements RecordingServiceState {
    public readonly name = 'recording';
    public static readonly default_mime_type = 'video/webm';
    private media_recorder: MediaRecorder;
    private mime_type: Optional<string> = null;
    private t0 = moment();
    private chunks: Blob[] = [];

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
        service.set_state(new NotRecording());
        const mime_type = this.mime_type || DefaultMimeType;
        const blob = new Blob(this.chunks, { type: mime_type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = `BeddyBytes_${this.t0.format('YYYYMMDD_HHmmss')}`;
        Promise.resolve().then(() => {
            a.click();
            document.body.removeChild(a);
        });
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
    private readonly proxy: ServiceProxy;

    constructor(input: NewRecordingServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: new NotRecording(),
        });
        this.proxy = {
            logging_service: input.logging_service,
            session_service: input.session_service,
            media_stream: input.media_stream,
            get_state: this.get_state,
            set_state: this.set_state,
        };
    }

    protected to_string = (state: RecordingServiceState): string => {
        return state.name;
    }

    public start = (): void => {
        const state = this.get_state();
        state.start(this.proxy);
    }

    public stop = (): void => {
        const state = this.get_state();
        state.stop(this.proxy);
    }
}

export default RecordingService;