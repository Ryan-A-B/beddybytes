import React from 'react';
import AudioStream from './AudioStream';
import VideoStream from './VideoStream';
import useClientRTCConnectionStreamStatus from '../../hooks/useClientRTCConnectionStreamStatus';
import useClientSessionStatus from '../../hooks/useClientSessionStatus';

const Stream: React.FunctionComponent = () => {
    const client_session_status = useClientSessionStatus();
    const rtc_connection_stream_status = useClientRTCConnectionStreamStatus(client_session_status);
    if (client_session_status.status !== "joined") return null;
    if (rtc_connection_stream_status.status === "not_available") return (
        <p>
            Waiting for stream...
        </p>
    );
    const stream = rtc_connection_stream_status.stream;
    const audioOnly = stream.getVideoTracks().length === 0;
    if (audioOnly) return <AudioStream stream={stream} />
    return <VideoStream stream={stream} />
}

export default Stream;
