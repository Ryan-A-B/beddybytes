export const EventTypeMediaDevicesPermissionStatusChanged = 'media_devices_permission_status_changed';
export const EventTypeMediaStreamStatusChanged = 'media_stream_status_changed';

interface MediaDevicesPermissionStatusNotRequested {
    status: 'not_requested';
}

interface MediaDevicesPermissionStatusRequested {
    status: 'requested';
}

interface MediaDevicesPermissionStatusGranted {
    status: 'granted';
}

interface MediaDevicesPermissionStatusDenied {
    status: 'denied';
}

export type MediaDevicesPermissionStatus = MediaDevicesPermissionStatusNotRequested | MediaDevicesPermissionStatusRequested | MediaDevicesPermissionStatusGranted | MediaDevicesPermissionStatusDenied;

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

class MediaStreamService extends EventTarget {
    private permission_status: MediaDevicesPermissionStatus = { status: 'not_requested' };
    private media_stream_status: MediaStreamStatus = { status: 'not_running' };

    public get_media_stream_status = (): MediaStreamStatus => {
        return this.media_stream_status;
    }

    private set_media_stream_status = (media_stream_status: MediaStreamStatus): void => {
        this.media_stream_status = media_stream_status;
        this.dispatchEvent(new Event(EventTypeMediaStreamStatusChanged));
    }

    public start_media_stream = async (input: StartMediaStreamInput): Promise<void> => {
        if (this.permission_status.status !== 'granted') throw new Error('Permission not granted');
        if (this.media_stream_status.status !== 'not_running') throw new Error('Media stream already running');
        this.set_media_stream_status({ status: 'starting' });
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: MediaStreamService.get_audio_constraint(input.audio_device_id),
                video: MediaStreamService.get_video_constraint(input.video_device_id),
            });
            this.set_media_stream_status({ status: 'running', media_stream: stream });
        } catch (error) {
            this.set_media_stream_status({ status: 'rejected', error });
        }
    }

    public stop_media_stream = (): void => {
        if (this.media_stream_status.status !== 'running') return;
        this.media_stream_status.media_stream.getTracks().forEach((track) => track.stop());
        this.set_media_stream_status({ status: 'not_running' });
    }

    // TODO move this to a separate service
    public get_permission_status = (): MediaDevicesPermissionStatus => {
        return this.permission_status;
    }

    private set_permission_status = (permission_status: MediaDevicesPermissionStatus): void => {
        this.permission_status = permission_status;
        this.dispatchEvent(new Event(EventTypeMediaDevicesPermissionStatusChanged));
    }

    public requestVideoAndAudioPermission = async () => {
        if (this.permission_status.status !== 'not_requested') return;
        try {
            this.set_permission_status({ status: 'requested' });
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach((track) => track.stop());
            this.set_permission_status({ status: 'granted' });
        } catch (error) {
            this.set_permission_status({ status: 'denied' });
        }
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
