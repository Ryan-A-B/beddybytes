import React from "react";
import Connections from "./Connections";
import useConnectionStatus from "../../hooks/useConnectionStatus";
import useMediaStream from "../../hooks/useMediaStream";

interface Props {
    audioDeviceID: string
    videoDeviceID: string
    sessionActive: boolean
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