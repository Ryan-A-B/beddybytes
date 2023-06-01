import React from "react";
import * as DeviceRegistrar from '../DeviceRegistrar';
import usePromise from "../hooks/usePromise";
import Connections from "./Connections";
import { useConfig } from "../Config";
import { useAccessToken } from "../AuthorizationServer";

interface Props {
    videoDeviceID: string
}

const VideoStream: React.FunctionComponent<Props> = ({ videoDeviceID }) => {
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
    const [isStarted, setIsStarted] = React.useState(false);
    React.useEffect(() => {
        setIsStarted(false);
    }, [videoDeviceID])
    const onClick = React.useCallback(() => {
        setIsStarted(true);
    }, []);
    React.useEffect(() => {
        if (!isStarted) return;
        if (stream.state !== 'resolved') throw new Error('Stream is not resolved');
        const connections = new Connections(config, client, stream.value, accessToken);
        return connections.close;
    }, [config, client, stream, isStarted, accessToken]);
    if (stream.state === 'pending') return (<div>Getting stream...</div>)
    if (stream.state === 'rejected') return (<div>Failed to get stream: {stream.error.message}</div>)
    return (
        <React.Fragment>
            <video ref={videoRef} autoPlay playsInline muted className="video" />
            {!isStarted && (
                <button onClick={onClick} className="btn btn-primary">
                    Start
                </button>
            )}
        </React.Fragment>
    )
};

export default VideoStream;