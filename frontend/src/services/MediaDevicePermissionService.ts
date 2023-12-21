import Severity from "./LoggingService/Severity";

export const EventTypeMediaDevicePermissionStatusChanged = 'media_device_permission_status_changed';

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

export type MediaDevicePermissionStatus = MediaDevicesPermissionStatusNotRequested | MediaDevicesPermissionStatusRequested | MediaDevicesPermissionStatusGranted | MediaDevicesPermissionStatusDenied;

interface NewMediaDevicePermissionServiceInput {
    logging_service: LoggingService;
}

class MediaDevicePermissionService extends EventTarget {
    private logging_service: LoggingService;
    private status: MediaDevicePermissionStatus = { status: 'not_requested' };

    constructor(input: NewMediaDevicePermissionServiceInput) {
        super();
        this.logging_service = input.logging_service;
    }

    public get_status = (): MediaDevicePermissionStatus => {
        return this.status;
    }

    private set_status = (permission_status: MediaDevicePermissionStatus): void => {
        this.logging_service.log({
            severity: Severity.Debug,
            message: `Media device permission status changed from ${this.status.status} to ${permission_status.status}`,
        });
        this.status = permission_status;
        this.dispatchEvent(new Event(EventTypeMediaDevicePermissionStatusChanged));
    }

    public requestVideoAndAudioPermission = async () => {
        if (this.status.status !== 'not_requested') return;
        try {
            this.set_status({ status: 'requested' });
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach((track) => track.stop());
            this.set_status({ status: 'granted' });
        } catch (error) {
            this.set_status({ status: 'denied' });
        }
    }
}

export default MediaDevicePermissionService;