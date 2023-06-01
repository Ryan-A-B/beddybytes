import React from 'react';
import * as DeviceRegistrar from '../DeviceRegistrar';
import Connection from './Connection';
import { useConfig } from '../Config';
import { useAccessToken } from '../AuthorizationServer';

interface Props {
    peerID: string
}

const Video: React.FunctionComponent<Props> = ({ peerID }) => {
    const config = useConfig();
    const accessToken = useAccessToken();
    const client = DeviceRegistrar.useDevice();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    React.useEffect(() => {
        if (videoRef.current === null)
            throw new Error("videoRef.current is null");
        const video = videoRef.current;
        const connection = new Connection(config, client, peerID, accessToken);
        connection.ontrack = (event: RTCTrackEvent) => {
            const stream = event.streams[0];
            video.srcObject = stream;
            video.play();
        };
        return () => {
            connection.close();
        }
    }, [config, client, peerID])
    return (
        <video ref={videoRef} playsInline className="video" />
    )
}

export default Video;