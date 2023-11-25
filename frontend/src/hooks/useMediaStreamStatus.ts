import React from "react";
import { EventTypeMediaStreamStatusChanged, MediaStreamStatus } from "../services/MediaStreamService";
import media_stream_service from "../instances/media_stream_service";

const useMediaStreamStatus = (): MediaStreamStatus => {
    const [mediaStreamStatus, setMediaStreamStatus] = React.useState<MediaStreamStatus>(media_stream_service.get_status);
    React.useEffect(() => {
        const handle_media_stream_status_change = () => {
            setMediaStreamStatus(media_stream_service.get_status);
        }
        media_stream_service.addEventListener(EventTypeMediaStreamStatusChanged, handle_media_stream_status_change);
        return () => {
            media_stream_service.removeEventListener(EventTypeMediaStreamStatusChanged, handle_media_stream_status_change);
        }
    }, []);
    return mediaStreamStatus;
}

export default useMediaStreamStatus;