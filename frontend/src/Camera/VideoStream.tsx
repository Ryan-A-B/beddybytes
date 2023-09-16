import React from "react";
import { Session } from "../Sessions/Sessions";
import usePromise from "../hooks/usePromise";
import Connections from "./Connections";
import useConnection from "../Connection/useConnection";

interface Props {
    videoDeviceID: string
    sessionActive: boolean
}

const VideoStream: React.FunctionComponent<Props> = ({ videoDeviceID, sessionActive }) => {
    const connection = useConnection();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const getUserMedia = React.useMemo(() => {
        return navigator.mediaDevices.getUserMedia({
            video: { deviceId: videoDeviceID },
            audio: true,
        });
    }, [videoDeviceID]);
    const stream = usePromise(getUserMedia);
    React.useEffect(() => {
        if (stream.state !== 'resolved') return;
        if (videoRef.current === null) return;
        const video = videoRef.current;
        video.srcObject = stream.value;
        return () => {
            video.srcObject = null;
        }
    }, [stream]);
    React.useEffect(() => {
        if (!sessionActive) return;
        if (stream.state !== 'resolved') throw new Error('Stream is not resolved');
        const connections = new Connections(connection, stream.value);
        return connections.close;
    }, [connection, stream]);
    if (stream.state === 'pending') return (<div>Getting stream...</div>)
    if (stream.state === 'rejected') return (<div>Failed to get stream: {stream.error.message}</div>)
    return (
        <video ref={videoRef} autoPlay playsInline muted className="video my-3" />
    )
};

export default VideoStream;