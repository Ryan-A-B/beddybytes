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

type MediaDevicePermissionStatus =
    MediaDevicesPermissionStatusNotRequested |
    MediaDevicesPermissionStatusRequested |
    MediaDevicesPermissionStatusGranted |
    MediaDevicesPermissionStatusDenied;

interface MediaDevicePermissionService {
    get_status(): MediaDevicePermissionStatus;
    request_video_and_audio_permission(): Promise<void>;
}