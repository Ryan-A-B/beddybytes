import LoggingService, { Severity } from '../../LoggingService';
import MediaDevicePermissionService from "../MediaDevicePermissionService";

export const EventTypeMediaStreamStatusChanged = 'media_stream_status_changed';

interface NewMediaStreamServiceInput {
    logging_service: LoggingService;
    media_device_permission_service: MediaDevicePermissionService;
}

class MediaStreamService extends EventTarget {
    private logging_service: LoggingService;
    private media_device_permission_service: MediaDevicePermissionService;
    private status: MediaStreamStatus = { status: 'not_running' };

    constructor(input: NewMediaStreamServiceInput) {
        super();
        this.logging_service = input.logging_service;
        this.media_device_permission_service = input.media_device_permission_service;
    }

    public get_status = (): MediaStreamStatus => {
        return this.status;
    }

    private set_status = (media_stream_status: MediaStreamStatus): void => {
        this.logging_service.log({
            severity: Severity.Debug,
            message: `Media stream status changed from ${this.status.status} to ${media_stream_status.status}`,
        });
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
