import React from "react";
import useMediaStreamStatus from "./useMediaStreamStatus";
import baby_station from "../services/instances/baby_station";

const useMediaStream = (audioDeviceID: string, videoDeviceID: string): MediaStreamStatus => {
    const media_stream_service = baby_station.media_stream_service;
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