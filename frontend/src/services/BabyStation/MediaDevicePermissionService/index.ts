import { stat } from 'fs';
import LoggingService, { Severity } from '../../LoggingService';
import Service from '../../Service';

interface MediaDevicesPermissionStatusPrompt {
    state: 'prompt';
}

interface MediaDevicesPermissionStatusPrompted {
    state: 'prompted';
}

interface MediaDevicesPermissionStatusGranted {
    state: 'granted';
}

interface MediaDevicesPermissionStatusDenied {
    state: 'denied';
}

interface MediaDevicesPermissionStatusUnknown {
    state: 'unknown';
}

export type MediaDevicePermissionStatus =
    MediaDevicesPermissionStatusPrompt |
    MediaDevicesPermissionStatusPrompted |
    MediaDevicesPermissionStatusGranted |
    MediaDevicesPermissionStatusDenied |
    MediaDevicesPermissionStatusUnknown;

const InitialState = { state: 'prompt' } as MediaDevicePermissionStatus;

const PermissionDescriptorCamera: PermissionDescriptor = { name: 'camera' as PermissionName };
const PermissionDescriptorMicrophone: PermissionDescriptor = { name: 'microphone' as PermissionName };

interface NewMediaDevicePermissionServiceInput {
    logging_service: LoggingService;
}

class MediaDevicePermissionService extends Service<MediaDevicePermissionStatus> {
    private logging_service: LoggingService;

    constructor(input: NewMediaDevicePermissionServiceInput) {
        super(InitialState);
        this.logging_service = input.logging_service;
        this.query_permission_state();
    }

    private query_permission_state = async (): Promise<void> => {
        try {
            const [microphone_permission_status, camera_permission_status] = await Promise.all([
                navigator.permissions.query(PermissionDescriptorMicrophone),
                navigator.permissions.query(PermissionDescriptorCamera),
            ]);
            if (microphone_permission_status.state === 'denied' || camera_permission_status.state === 'denied') {
                this.set_state({ state: 'denied' });
                return;
            }
            if (microphone_permission_status.state === 'granted' && camera_permission_status.state === 'granted') {
                this.set_state({ state: 'granted' });
                return;
            }
        } catch (error: unknown) {
            if (error instanceof TypeError) {
                // Browser does not support the Permissions API or does not recognize the permission name
                this.set_state({ state: 'unknown' });
                return;
            }
            this.logging_service.log({
                severity: Severity.Error,
                message: `Failed to check if media device permissions are already granted with error: ${error}`
            });
        }
    }

    public request_video_and_audio_permission = async () => {
        const state = this.get_state();
        if (!['prompt', 'unknown'].includes(state.state)) return;
        try {
            this.set_state({ state: 'prompted' });
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach((track) => track.stop());
            this.set_state({ state: 'granted' });
        } catch (error) {
            this.set_state({ state: 'denied' });
        }
    }
}

export default MediaDevicePermissionService;
