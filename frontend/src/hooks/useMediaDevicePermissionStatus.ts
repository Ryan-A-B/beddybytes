import { MediaDevicePermissionStatus } from '../services/BabyStation/MediaDevicePermissionService';
import baby_station from '../services/instances/baby_station';
import useServiceState from './useServiceState';

const useMediaDevicesPermissionStatus = (): MediaDevicePermissionStatus => {
    const media_device_permission_service = baby_station.media_device_permission_service;
    return useServiceState(media_device_permission_service);
}

export default useMediaDevicesPermissionStatus;
