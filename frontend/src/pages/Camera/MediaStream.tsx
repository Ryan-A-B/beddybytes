import React from "react";
import Connections from "./Connections";
import media_stream_service from "../../instances/media_stream_service";
import host_video_transform_service from "../../instances/host_video_transform_service";
import useConnectionStatus from "../../hooks/useConnectionStatus";
import useMediaStream from "../../hooks/useMediaStream";
import useHostVideoTransformStatus from "../../hooks/useHostVideoTransformStatus";

interface Props {
    audioDeviceID: string
    videoDeviceID: string
    sessionActive: boolean
}

const MediaStream: React.FunctionComponent<Props> = ({ audioDeviceID, videoDeviceID, sessionActive }) => {
    const connection_status = useConnectionStatus();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const media_stream_status = useMediaStream(audioDeviceID, videoDeviceID);
    const host_video_transform_status = useHostVideoTransformStatus(host_video_transform_service);
    const start_media_stream = React.useCallback(async () => {
        await media_stream_service.start_media_stream({
            audio_device_id: audioDeviceID,
            video_device_id: videoDeviceID,
        });
    }, [audioDeviceID, videoDeviceID]);
    React.useLayoutEffect(() => {
        if (media_stream_status.status !== 'running') return;
        if (videoRef.current === null) return;
        const video = videoRef.current;
        if (host_video_transform_status.status === 'running') {
            video.srcObject = host_video_transform_status.transformed_media_stream;
        } else {
            video.srcObject = media_stream_status.media_stream;
        }
        return () => {
            video.srcObject = null;
        }
    }, [media_stream_status, host_video_transform_status]);
    React.useEffect(() => {
        if (host_video_transform_status.status !== 'running') return;
        const media_stream = host_video_transform_status.transformed_media_stream;
        if (connection_status.status === 'not_connected') throw new Error('Connection is not connected');
        const connection = connection_status.connection;
        const connections = new Connections(connection, media_stream);
        return connections.close;
    }, [connection_status, host_video_transform_status]);
    if (media_stream_status.status === 'starting') return (<div>Getting stream...</div>)
    if (media_stream_status.status === 'rejected') return (
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
            muted
            className={`video my-3 ${sessionActive && 'active'}`}
        />
    )
};

export default MediaStream;