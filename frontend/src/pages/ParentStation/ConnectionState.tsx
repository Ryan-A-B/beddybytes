import React from 'react';
import useMediaStreamDisconnectMonitor from '../../hooks/useMediaStreamDisconnectMonitor';

type Props = {
    stream: MediaStream
}

const ConnectionState: React.FunctionComponent<Props> = ({ stream }) => {
    const mediaStreamConnectionState = useMediaStreamDisconnectMonitor(stream);
    if (mediaStreamConnectionState.state === 'connected') return null;
    if (mediaStreamConnectionState.state === 'unstable') return (
        <p className="align-self-center">Connection unstable</p>
    );
    if (mediaStreamConnectionState.state === 'disconnected') return (
        <p className="align-self-center">Connection lost</p>
    );
    throw new Error(`Unknown state: ${mediaStreamConnectionState}`);
}

export default ConnectionState;
