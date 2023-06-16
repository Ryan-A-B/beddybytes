import React from 'react';
import * as DeviceRegistrar from '../DeviceRegistrar';
import Connection from './Connection';
import { useConfig } from '../Config';
import { useAccessToken } from '../AuthorizationServer';

interface Props {
    peerID: string
}

const isConnectionLost = (connectionState: RTCPeerConnectionState) => {
    if (connectionState === "disconnected") return true;
    if (connectionState === "failed") return true;
    if (connectionState === "closed") return true;
    return false;
}


const Video: React.FunctionComponent<Props> = ({ peerID }) => {
    const config = useConfig();
    const accessToken = useAccessToken();
    const client = DeviceRegistrar.useDevice();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [connectionState, setConnectionState] = React.useState<RTCPeerConnectionState>("new");
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
        connection.onconnectionstatechange = (event: Event) => {
            if (event.type !== "connectionstatechange") throw new Error("event.type is not connectionstatechange");
            const connection = event.target as RTCPeerConnection;
            setConnectionState(connection.connectionState);
            console.log(`connectionState: ${connection.connectionState}`);
        };
        return () => {
            connection.close();
        }
    }, [config, client, peerID]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <React.Fragment>
            {isConnectionLost(connectionState) && (
                <div className="alert alert-danger" role="alert">
                    Connection Lost
                </div>
            )}
            <video ref={videoRef} playsInline className="video" />
        </React.Fragment>
    )
}

export default Video;