import LoggingService from "../LoggingService";
import Service from "../Service";

type AudioAndVideo = 'audio-and-video';
type AudioOnly = 'audio-only';
type NoTracks = 'no-tracks';

export type MediaStreamTrackState = AudioAndVideo | AudioOnly | NoTracks;

const InitialState: MediaStreamTrackState = 'no-tracks';

interface NewMediaStreamTrackMonitorInput {
    logging_service: LoggingService;
    media_stream: MediaStream;
}

class MediaStreamTrackMonitor extends Service<MediaStreamTrackState> {
    protected readonly name = 'MediaStreamTrackMonitor';
    private media_stream: MediaStream;

    constructor(input: NewMediaStreamTrackMonitorInput) {
        super({
            logging_service: input.logging_service,
            initial_state: InitialState,
        });
        this.media_stream = input.media_stream;
        this.media_stream.addEventListener('addtrack', this.handle_add_track);
        this.media_stream.addEventListener('removetrack', this.handle_remove_track);
    }

    protected to_string = (state: MediaStreamTrackState): string => {
        return state;
    }

    private handle_add_track = (event: MediaStreamTrackEvent) => {
        this.handle_track_change();
    }

    private handle_remove_track = (event: MediaStreamTrackEvent) => {
        this.handle_track_change();
    }

    // TODO we expect add and remove to happen in pairs. debounce?
    private handle_track_change = () => {
        const audio_tracks = this.media_stream.getAudioTracks();
        if (audio_tracks.length === 0) {
            this.set_state('no-tracks');
            return;
        }
        const video_tracks = this.media_stream.getVideoTracks();
        if (video_tracks.length === 0) {
            this.set_state('audio-only');
            return;
        }
        this.set_state('audio-and-video');
    }

    public close = () => {
        this.media_stream.removeEventListener('addtrack', this.handle_add_track);
        this.media_stream.removeEventListener('removetrack', this.handle_remove_track);
    }
}

export default MediaStreamTrackMonitor;