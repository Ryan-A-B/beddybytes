import moment from 'moment';
import Service, { SetStateFunction } from '../Service';
import SessionService from './SessionService';
import LoggingService from '../LoggingService';

interface RecordingServiceState {
    name: string;
    start: (set_state: SetStateFunction<RecordingServiceState>) => void;
    stop: (set_state: SetStateFunction<RecordingServiceState>) => void;
}

interface NewNotRecordingInput {
    session_service: SessionService;
    media_stream: MediaStream;
}

class NotRecording implements RecordingServiceState {
    public readonly name = 'not_recording';

    private session_service: SessionService;
    private media_stream: MediaStream;

    constructor(input: NewNotRecordingInput) {
        this.session_service = input.session_service;
        this.media_stream = input.media_stream;
    }

    start = (set_state: (state: RecordingServiceState) => void) => {
        const session_state = this.session_service.get_state();
        if (session_state.state !== 'joined')
            throw new Error('Cannot start recording when not joined to a session');
        const recorder = new Recorder(this.media_stream);
        recorder.addEventListener('stop', () => {
            set_state(this);
        });
        set_state(new Recording(recorder));
    }

    stop = (set_state: SetStateFunction<RecordingServiceState>) => {
        throw new Error('Cannot stop recording when not recording');
    }
}

class Recording implements RecordingServiceState {
    public readonly name = 'recording';
    private recorder: Recorder;

    constructor(recorder: Recorder) {
        this.recorder = recorder;
    }

    public start = (set_state: SetStateFunction<RecordingServiceState>) => {
        throw new Error('Cannot start recording when already recording');
    }

    public stop = (set_state: SetStateFunction<RecordingServiceState>) => {
        this.recorder.stop();
        // we don't call set_state here because NotRecording will call it when the recorder stops
    }
}

interface NewRecordingServiceInput {
    logging_service: LoggingService;
    session_service: SessionService;
    media_stream: MediaStream;
}

class RecordingService extends Service<RecordingServiceState> {
    protected readonly name = 'RecordingService';

    constructor(input: NewRecordingServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: new NotRecording({
                session_service: input.session_service,
                media_stream: input.media_stream,
            }),
        });
    }

    protected to_string = (state: RecordingServiceState): string => {
        return state.name;
    }

    public start = (): void => {
        const state = this.get_state();
        state.start(this.set_state);
    }

    public stop = (): void => {
        const state = this.get_state();
        state.stop(this.set_state);
    }
}

export default RecordingService;

class Recorder extends EventTarget {
    private media_recorder: MediaRecorder;
    private t0 = moment();
    private chunks: Blob[] = [];

    constructor(media_stream: MediaStream) {
        super();
        this.media_recorder = new MediaRecorder(media_stream);
        this.media_recorder.addEventListener('dataavailable', this.handle_dataavailable);
        this.media_recorder.addEventListener('stop', this.handle_stop);
        this.media_recorder.start();
    }

    public stop = () => {
        this.media_recorder.stop();
    }

    private handle_dataavailable = (event: BlobEvent) => {
        this.chunks.push(event.data);
    }

    private handle_stop = () => {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.target = '_blank';
        a.download = `BeddyBytes_${this.t0.format('YYYYMMDD_HHmmss')}.webm`;
        a.click();
        this.dispatchEvent(new Event('stop'));
    }
}