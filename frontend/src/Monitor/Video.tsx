import React from 'react';
import * as DeviceRegistrar from '../DeviceRegistrar';
import Connection from './Connection';

interface Props {
    peerID: string
}

const Video: React.FunctionComponent<Props> = ({ peerID }) => {
    const client = DeviceRegistrar.useDevice();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    React.useEffect(() => {
        if (videoRef.current === null)
            throw new Error("videoRef.current is null");
        const video = videoRef.current;
        const connection = new Connection(client.id, peerID);
        connection.ontrack = (event: RTCTrackEvent) => {
            const stream = event.streams[0];
            video.srcObject = stream;
            video.play();
        };
        return () => {
            connection.close();
        }
    }, [])
    return (
        <video ref={videoRef} playsInline className="video" />
    )
}

export default Video;