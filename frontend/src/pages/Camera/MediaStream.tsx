import React from "react";
import Connections from "./Connections";
import media_stream_service from "../../instances/media_stream_service";
import useMediaStream from "../../hooks/useMediaStream";
import useSignalService from "../../hooks/useSignalService";

interface Props {
    audioDeviceID: string
    videoDeviceID: string
    sessionActive: boolean
}

const MediaStream: React.FunctionComponent<Props> = ({ audioDeviceID, videoDeviceID, sessionActive }) => {
    const signal_service = useSignalService();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const mediaStreamStatus = useMediaStream(audioDeviceID, videoDeviceID);
    const start_media_stream = React.useCallback(async () => {
        await media_stream_service.start_media_stream({
            audio_device_id: audioDeviceID,
            video_device_id: videoDeviceID,
        });
    }, [audioDeviceID, videoDeviceID]);
    React.useLayoutEffect(() => {
        if (mediaStreamStatus.status !== 'running') return;
        if (videoRef.current === null) return;
        const video = videoRef.current;
        video.srcObject = mediaStreamStatus.media_stream;
        return () => {
            video.srcObject = null;
        }
    }, [mediaStreamStatus]);
    React.useEffect(() => {
        if (!sessionActive) return;
        if (mediaStreamStatus.status !== 'running') throw new Error('Stream is not resolved');
        const connections = new Connections(signal_service, mediaStreamStatus.media_stream);
        return connections.close;
    }, [signal_service, sessionActive, mediaStreamStatus]);
    if (mediaStreamStatus.status === 'starting') return (<div>Getting stream...</div>)
    if (mediaStreamStatus.status === 'rejected') return (
        <div className="mt-3">
            <p>Failed to get stream.</p>
            <button className="btn btn-primary" onClick={start_media_stream}>
                Retry
            </button>
        </div>
    )
    // TODO render a basic audio visualizer
    if (videoDeviceID === '') return (
        <div>
            Audio only
        </div>
    )
    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`video my-3 ${sessionActive && 'active'}`}
        />
    )
};

export default MediaStream;