import React from "react";
import * as DeviceRegistrar from '../DeviceRegistrar';
import usePromise from "../hooks/usePromise";
import Connections from "./Connections";
import { useConfig } from "../Config";
import { useAccessToken } from "../AuthorizationServer";

interface Props {
    videoDeviceID: string
    sessionName: string
    sessionActive: boolean
}

const VideoStream: React.FunctionComponent<Props> = ({ videoDeviceID, sessionName, sessionActive }) => {
    const config = useConfig();
    const accessToken = useAccessToken();
    const client = DeviceRegistrar.useDevice();
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
        videoRef.current.srcObject = stream.value;
    }, [stream]);
    React.useEffect(() => {
        if (!sessionActive) return;
        if (stream.state !== 'resolved') throw new Error('Stream is not resolved');
        const connections = new Connections(config, client.id, sessionName, stream.value, accessToken);
        return connections.close;
    }, [config, client.id, stream, sessionName, sessionActive]); // eslint-disable-line react-hooks/exhaustive-deps
    if (stream.state === 'pending') return (<div>Getting stream...</div>)
    if (stream.state === 'rejected') return (<div>Failed to get stream: {stream.error.message}</div>)
    return (
        <video ref={videoRef} autoPlay playsInline muted className="video my-3" />
    )
};

export default VideoStream;