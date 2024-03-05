import React from 'react';
import useMediaStreamDisconnectMonitor from '../../services/MediaStreamDisconnectMonitor/useMediaStreamDisconnectMonitor';

type Props = {
    stream: MediaStream
}

const ConnectionState: React.FunctionComponent<Props> = ({ stream }) => {
    const mediaStreamConnectionState = useMediaStreamDisconnectMonitor(stream);
    if (mediaStreamConnectionState.state === 'connected') return null;
    if (mediaStreamConnectionState.state === 'unstable') return (
        <p>Connection unstable</p>
    );
    if (mediaStreamConnectionState.state === 'disconnected') return (
        <p>Connection lost</p>
    );
    throw new Error(`Unknown state: ${mediaStreamConnectionState}`);
}

export default ConnectionState;
