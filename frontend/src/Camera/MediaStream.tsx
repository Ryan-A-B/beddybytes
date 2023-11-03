import React from "react";
import usePromise from "../hooks/usePromise";
import Connections from "./Connections";
import useConnection from "../Connection/useConnection";

interface Props {
    audioDeviceID: string
    videoDeviceID: string
    sessionActive: boolean
}

const getAudioConstraint = (audioDeviceID: string): MediaStreamConstraints["audio"] => {
    if (audioDeviceID === '') return true;
    return { deviceId: audioDeviceID };
}

const getVideoConstraint = (videoDeviceID: string): MediaStreamConstraints["video"] => {
    if (videoDeviceID === '') return false;
    return { deviceId: videoDeviceID };
}

const MediaStream: React.FunctionComponent<Props> = ({ audioDeviceID, videoDeviceID, sessionActive }) => {
    const connection = useConnection();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const getUserMedia = React.useMemo(() => {
        return navigator.mediaDevices.getUserMedia({
            audio: getAudioConstraint(audioDeviceID),
            video: getVideoConstraint(videoDeviceID),
        });
    }, [audioDeviceID, videoDeviceID]);
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
    }, [connection, sessionActive, stream]);
    if (stream.state === 'pending') return (<div>Getting stream...</div>)
    if (stream.state === 'rejected') return (<div>Failed to get stream: {stream.error.message}</div>)
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