import MediaDevicePermissionService from "./MediaDevicePermissionService";

export const EventTypeMediaStreamStatusChanged = 'media_stream_status_changed';

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

export type MediaStreamStatus = MediaStreamStatusNotRunning | MediaStreamStatusStarting | MediaStreamStatusRunning | MediaStreamStatusRejected;

interface StartMediaStreamInput {
    audio_device_id: string;
    video_device_id: string;
}

interface NewMediaStreamServiceInput {
    media_device_permission_service: MediaDevicePermissionService;
}

class MediaStreamService extends EventTarget {
    private media_device_permission_service: MediaDevicePermissionService;
    private status: MediaStreamStatus = { status: 'not_running' };

    constructor(input: NewMediaStreamServiceInput) {
        super();
        this.media_device_permission_service = input.media_device_permission_service;
    }

    public get_status = (): MediaStreamStatus => {
        return this.status;
    }

    private set_status = (media_stream_status: MediaStreamStatus): void => {
        this.status = media_stream_status;
        this.dispatchEvent(new Event(EventTypeMediaStreamStatusChanged));
    }

    public start_media_stream = async (input: StartMediaStreamInput): Promise<void> => {
        if (this.media_device_permission_service.get_status().status !== 'granted')
            throw new Error('Media device permission not granted');
        if (this.status.status === 'running' || this.status.status === 'starting')
            throw new Error('Media stream already running');
        this.set_status({ status: 'starting' });
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: MediaStreamService.get_audio_constraint(input.audio_device_id),
                video: MediaStreamService.get_video_constraint(input.video_device_id),
            });
            this.set_status({ status: 'running', media_stream: stream });
        } catch (error) {
            this.set_status({ status: 'rejected', error });
        }
    }

    public stop_media_stream = (): void => {
        if (this.status.status !== 'running') return;
        this.status.media_stream.getTracks().forEach((track) => track.stop());
        this.set_status({ status: 'not_running' });
    }

    private static get_audio_constraint = (audio_device_id: string): MediaStreamConstraints["audio"] => {
        if (audio_device_id === '') return true;
        return { deviceId: audio_device_id };
    }

    private static get_video_constraint = (video_device_id: string): MediaStreamConstraints["video"] => {
        if (video_device_id === '') return false;
        return { deviceId: video_device_id };
    }
}

export default MediaStreamService;
