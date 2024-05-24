import moment from 'moment';

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
    session_service: ParentStationSessionService;
}

class RecordingService extends EventTarget {
    private session_service: ParentStationSessionService;
    private state: RecordingServiceState = InitialState;

    constructor(input: NewRecordingServiceInput) {
        super();
        this.session_service = input.session_service;
    }

    public get_state = (): RecordingServiceState => {
        return this.state;
    }

    private set_state = (state: RecordingServiceState): void => {
        this.state = state;
        this.dispatchEvent(new Event('statechange'));
    }

    public start = (): void => {
        const session_state = this.session_service.get_state();
        if (session_state.state !== 'joined')
            throw new Error('Cannot start recording when not joined to a session');
        const connection = session_state.client_connection;
        const media_stream_state = connection.get_media_stream_state();
        if (media_stream_state.state !== 'available')
            throw new Error('Cannot start recording when media stream is not available');
        if (this.state.state === 'recording')
            throw new Error('Cannot start recording when already recording');
        const t0 = moment();
        const media_recorder = new MediaRecorder(media_stream_state.media_stream);
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
        if (this.state.state === 'not_recording')
            throw new Error('Cannot stop recording when not recording');
        this.state.media_recorder.stop();
    }
}

export default RecordingService;
