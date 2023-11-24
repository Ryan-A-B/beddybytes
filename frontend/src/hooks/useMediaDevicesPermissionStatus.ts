import React from 'react';
import { MediaDevicesPermissionStatus, EventTypeMediaDevicesPermissionStatusChanged } from '../services/MediaStreamService';
import media_stream_service from '../instances/media_stream_service';

const useMediaDevicesPermissionStatus = (): MediaDevicesPermissionStatus => {
    const [permission_status, set_permission_status] = React.useState<MediaDevicesPermissionStatus>(media_stream_service.get_permission_status);
    React.useEffect(() => {
        const handle_permission_status_changed = () => {
            set_permission_status(media_stream_service.get_permission_status());
        };
        media_stream_service.addEventListener(EventTypeMediaDevicesPermissionStatusChanged, handle_permission_status_changed);
        media_stream_service.requestVideoAndAudioPermission();
        return () => {
            media_stream_service.removeEventListener(EventTypeMediaDevicesPermissionStatusChanged, handle_permission_status_changed);
        }
    }, []);
    return permission_status
}

export default useMediaDevicesPermissionStatus;
