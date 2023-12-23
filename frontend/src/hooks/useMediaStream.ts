import React from "react";
import { MediaStreamStatus } from "../services/MediaStreamService";
import useMediaStreamStatus from "./useMediaStreamStatus";
import { useMediaStreamService } from "../services";

const useMediaStream = (audioDeviceID: string, videoDeviceID: string): MediaStreamStatus => {
    const media_stream_service = useMediaStreamService();
    const mediaStreamStatus = useMediaStreamStatus();
    React.useEffect(() => {
        media_stream_service.start_media_stream({
            audio_device_id: audioDeviceID,
            video_device_id: videoDeviceID,
        });
        return () => {
            media_stream_service.stop_media_stream();
        }
    }, [media_stream_service, audioDeviceID, videoDeviceID]);
    return mediaStreamStatus;
}

export default useMediaStream;