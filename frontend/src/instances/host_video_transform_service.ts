import HostVideoTransformService from "../services/HostVideoTransformService";
import host_session_service from "./host_session_service";
import media_stream_service from "./media_stream_service";

const host_video_transform_service = new HostVideoTransformService({
    media_stream_service,
    host_session_service,
});

export default host_video_transform_service;