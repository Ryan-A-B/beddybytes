import MediaStreamService from "../MediaStreamService";
import influx_logging_service from "./logging_service";
import media_device_permission_service from "./media_device_permission_service";

const media_stream_service = new MediaStreamService({
    logging_service: influx_logging_service,
    media_device_permission_service,
});

export default media_stream_service;