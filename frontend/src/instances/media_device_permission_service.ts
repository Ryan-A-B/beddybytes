import MediaDevicePermissionService from "../services/MediaDevicePermissionService";
import influx_logging_service from "./logging_service";

const media_device_permission_service = new MediaDevicePermissionService({
    logging_service: influx_logging_service,
});

export default media_device_permission_service;