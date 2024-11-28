import moment from 'moment';
import Service, { EventTypeStateChanged } from '../Service';
import SessionService from './SessionService';
import LoggingService from '../LoggingService';

interface RecordingServiceStateNotRecording {
    state: 'not_recording';
}

interface RecordingServiceStateRecording {
    state: 'recording';
}

export type RecordingServiceState = RecordingServiceStateNotRecording | RecordingServiceStateRecording;

const InitialState: RecordingServiceState = { state: 'not_recording' };

interface NewRecordingServiceInput {
    logging_service: LoggingService;
    session_service: SessionService;
    media_stream: MediaStream;
}

class RecordingService extends Service<RecordingServiceState> {
    private static ChunkDuration = moment.duration(1, 'seconds');
    private static HindsightDuration = moment.duration(30, 'seconds');
    private static HindsightChunkCount = RecordingService.HindsightDuration.asSeconds() / RecordingService.ChunkDuration.asSeconds();
    private session_service: SessionService;
    private media_stream: MediaStream;
    private media_recorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];
    private hindsight_chunks: Blob[] = [];
    private hindsight_chunk_index = 0;

    constructor(input: NewRecordingServiceInput) {
        super({
            logging_service: input.logging_service,
            name: 'RecordingService',
            to_string: (state) => state.state,
            initial_state: InitialState,
        });
        this.session_service = input.session_service;
        this.media_stream = input.media_stream;

        this.session_service.addEventListener(EventTypeStateChanged, this.handle_session_state_changed);
        this.media_stream.addEventListener('addtrack', this.handle_addtrack);
    }

    private handle_session_state_changed = (): void => {
        this.start_hindsight_if_ready();
    }

    private handle_addtrack = (): void => {
        this.start_hindsight_if_ready();
    }

    private start_hindsight_if_ready = () => {
        const session_state = this.session_service.get_state();
        if (session_state.state !== 'joined') return;
        if (this.media_stream.active === false) return;
        console.log("start_hindsight_if_ready");
        if (this.media_recorder !== null) return;
        this.media_recorder = new MediaRecorder(this.media_stream);
        this.media_recorder.addEventListener('dataavailable', this.handle_dataavailable);
        this.media_recorder.addEventListener('stop', this.handle_stop);
        this.media_recorder.start(RecordingService.ChunkDuration.asMilliseconds());
    }

    private handle_dataavailable = (event: BlobEvent): void => {
        const state = this.get_state();
        if (state.state === 'recording') {
            this.chunks.push(event.data);
            return;
        }
        if (this.hindsight_chunks.length < RecordingService.HindsightChunkCount) {
            this.hindsight_chunks.push(event.data);
            console.log("Added hindsight chunk, count:", this.hindsight_chunks.length);
            return;
        }
        this.hindsight_chunks[this.hindsight_chunk_index] = event.data;
        console.log("Added hindsight chunk, index:", this.hindsight_chunk_index);
        this.hindsight_chunk_index = (this.hindsight_chunk_index + 1) % RecordingService.HindsightChunkCount;
    }

    private handle_stop = (event: Event): void => {
        if (event.target !== this.media_recorder)
            return;
        if (this.media_recorder === null)
            throw new Error('MediaRecorder is null');
        console.log("MediaRecorder stopped", event.target);
        this.reset(this.media_recorder);
    }

    private reset = (media_recorder: MediaRecorder): void => {
        media_recorder.removeEventListener('dataavailable', this.handle_dataavailable);
        media_recorder.removeEventListener('stop', this.handle_stop);
        this.media_recorder = null;
        this.chunks = [];
        this.hindsight_chunks = [];
        this.start_hindsight_if_ready();
    }

    public start = (): void => {
        const session_state = this.session_service.get_state();
        if (session_state.state !== 'joined')
            throw new Error('Cannot start recording when not joined to a session');
        const state = this.get_state();
        if (state.state === 'recording')
            throw new Error('Cannot start recording when already recording');
        this.set_state({ state: 'recording' });
    }

    public stop = (): void => {
        const state = this.get_state();
        if (state.state === 'not_recording')
            throw new Error('Cannot stop recording when not recording');
        if (this.media_recorder === null)
            throw new Error('MediaRecorder not initialized');
        if (this.media_recorder.state === 'inactive')
            throw new Error('MediaRecorder is inactive');

        // TODO need to get the last chunk of data from dataavailable event
        // Which means the first dataavailable event after stop is called should perform the download
        this.media_recorder.requestData();

        const chunks = [
            ...this.hindsight_chunks.slice(this.hindsight_chunk_index),
            ...this.hindsight_chunks.slice(0, this.hindsight_chunk_index),
            ...this.chunks,
        ]

        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.target = '_blank';
        a.download = `BeddyBytes_${moment().format('YYYYMMDD_HHmmss')}.webm`;
        a.click();

        this.set_state(InitialState);
        this.chunks = [];
        this.hindsight_chunks = [];
    }
}

export default RecordingService;
