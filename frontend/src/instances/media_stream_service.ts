import MediaStreamService from "../services/MediaStreamService";
import media_device_permission_service from "./media_device_permission_service";

const media_stream_service = new MediaStreamService({
    media_device_permission_service,
});

export default media_stream_service;