import moment from 'moment';
import Service from '../Service';
import SessionService from './SessionService';
import LoggingService from '../LoggingService';

interface RecordingServiceStateNotRecording {
    state: 'not_recording';
}

interface RecordingServiceStateRecording {
    state: 'recording';
    media_recorder: MediaRecorder;
}

export type RecordingServiceState = RecordingServiceStateNotRecording | RecordingServiceStateRecording;

const InitialState: RecordingServiceState = { state: 'not_recording' };

interface NewRecordingServiceInput {
    logging_service: LoggingService;
    session_service: SessionService;
    media_stream: MediaStream;
}

class RecordingService extends Service<RecordingServiceState> {
    private session_service: SessionService;
    private media_stream: MediaStream;

    constructor(input: NewRecordingServiceInput) {
        super({
            logging_service: input.logging_service,
            name: 'RecordingService',
            to_string: (state) => state.state,
            initial_state: InitialState,
        });
        this.session_service = input.session_service;
        this.media_stream = input.media_stream;
    }

    public start = (): void => {
        const session_state = this.session_service.get_state();
        if (session_state.state !== 'joined')
            throw new Error('Cannot start recording when not joined to a session');
        const state = this.get_state();
        if (state.state === 'recording')
            throw new Error('Cannot start recording when already recording');
        const t0 = moment();
        const media_recorder = new MediaRecorder(this.media_stream);
        const chunks: Blob[] = [];
        media_recorder.addEventListener('dataavailable', (event) => {
            chunks.push(event.data);
        });
        media_recorder.addEventListener('stop', () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            document.body.appendChild(a);
            a.style.display = 'none';
            a.href = url;
            a.target = '_blank';
            a.download = `BeddyBytes_${t0.format('YYYYMMDD_HHmmss')}.webm`;
            a.click();
            this.set_state(InitialState);
        });
        media_recorder.start();
        this.set_state({ state: 'recording', media_recorder });
    }

    public stop = (): void => {
        const state = this.get_state();
        if (state.state === 'not_recording')
            throw new Error('Cannot stop recording when not recording');
        state.media_recorder.stop();
    }
}

export default RecordingService;
