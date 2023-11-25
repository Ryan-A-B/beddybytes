import React from "react";
import { MediaStreamStatus } from "../services/MediaStreamService";
import media_stream_service from "../instances/media_stream_service";
import useMediaStreamStatus from "./useMediaStreamStatus";

const useMediaStream = (audioDeviceID: string, videoDeviceID: string): MediaStreamStatus => {
    const mediaStreamStatus = useMediaStreamStatus();
    React.useEffect(() => {
        media_stream_service.start_media_stream({
            audio_device_id: audioDeviceID,
            video_device_id: videoDeviceID,
        });
        return () => {
            media_stream_service.stop_media_stream();
        }
    }, [audioDeviceID, videoDeviceID]);
    return mediaStreamStatus;
}

export default useMediaStream;