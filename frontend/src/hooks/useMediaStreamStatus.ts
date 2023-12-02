import React from "react";
import { EventTypeMediaStreamStatusChanged, MediaStreamStatus } from "../services/MediaStreamService";
import media_stream_service from "../instances/media_stream_service";

const useMediaStreamStatus = (): MediaStreamStatus => {
    const [status, setStatus] = React.useState<MediaStreamStatus>(media_stream_service.get_status);
    React.useEffect(() => {
        const handle_status_change = () => {
            setStatus(media_stream_service.get_status());
        }
        media_stream_service.addEventListener(EventTypeMediaStreamStatusChanged, handle_status_change);
        return () => {
            media_stream_service.removeEventListener(EventTypeMediaStreamStatusChanged, handle_status_change);
        }
    }, []);
    return status;
}

export default useMediaStreamStatus;