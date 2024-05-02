interface MediaStreamStatusNotRunning {
    status: 'not_running';
}

interface MediaStreamStatusStarting {
    status: 'starting';
}

interface MediaStreamStatusRunning {
    status: 'running';
    media_stream: MediaStream;
}

interface MediaStreamStatusRejected {
    status: 'rejected';
    error: unknown;
}

type MediaStreamStatus =
    MediaStreamStatusNotRunning |
    MediaStreamStatusStarting |
    MediaStreamStatusRunning |
    MediaStreamStatusRejected;

interface StartMediaStreamInput {
    audio_device_id: string;
    video_device_id: string;
}

interface MediaStreamService {
    get_status(): MediaStreamStatus;
    start_media_stream(input: StartMediaStreamInput): Promise<void>;
    stop_media_stream(): void;
}