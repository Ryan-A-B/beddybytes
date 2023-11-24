import React from "react";
import usePromise from "../../hooks/usePromise";
import Connections from "./Connections";
import useConnectionStatus from "../../hooks/useConnectionStatus";
import { EventTypeMediaStreamStatusChanged, MediaStreamStatus } from "../../services/MediaStreamService";
import media_stream_service from "../../instances/media_stream_service";

interface Props {
    audioDeviceID: string
    videoDeviceID: string
    sessionActive: boolean
}

const useMediaStreamStatus = (): MediaStreamStatus => {
    const [mediaStreamStatus, setMediaStreamStatus] = React.useState<MediaStreamStatus>(media_stream_service.get_media_stream_status);
    React.useEffect(() => {
        const handle_media_stream_status_change = () => {
            setMediaStreamStatus(media_stream_service.get_media_stream_status);
        }
        media_stream_service.addEventListener(EventTypeMediaStreamStatusChanged, handle_media_stream_status_change);
        return () => {
            media_stream_service.removeEventListener(EventTypeMediaStreamStatusChanged, handle_media_stream_status_change);
        }
    }, []);
    return mediaStreamStatus;
}

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

const MediaStream: React.FunctionComponent<Props> = ({ audioDeviceID, videoDeviceID, sessionActive }) => {
    const connection_status = useConnectionStatus();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const mediaStreamStatus = useMediaStream(audioDeviceID, videoDeviceID);
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
        if (connection_status.status === 'not_connected') throw new Error('Connection is not connected');
        const connection = connection_status.connection;
        const connections = new Connections(connection, mediaStreamStatus.media_stream);
        return connections.close;
    }, [connection_status, sessionActive, mediaStreamStatus]);
    if (mediaStreamStatus.status === 'starting') return (<div>Getting stream...</div>)
    if (mediaStreamStatus.status === 'rejected') return (<div>Failed to get stream.</div>)
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