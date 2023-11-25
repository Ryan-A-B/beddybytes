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

class MediaDevicePermissionService extends EventTarget {
    private status: MediaDevicePermissionStatus = { status: 'not_requested' };

    public get_status = (): MediaDevicePermissionStatus => {
        return this.status;
    }

    private set_status = (permission_status: MediaDevicePermissionStatus): void => {
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