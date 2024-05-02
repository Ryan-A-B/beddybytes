import React from 'react';
import AudioStream from './AudioStream';
import VideoStream from './VideoStream';
import useMediaStreamState from '../../hooks/useMediaStreamState';
import useParentStationSessionState from '../../hooks/useParentStationSessionStatus';

const Stream: React.FunctionComponent = () => {
    const client_session_state = useParentStationSessionState();
    const media_stream_state = useMediaStreamState(client_session_state);
    if (client_session_state.state !== "joined") return null;
    if (media_stream_state.state === "not_available") return (
        <p>
            Waiting for stream...
        </p>
    );
    const stream = media_stream_state.media_stream;
    const audioOnly = stream.getVideoTracks().length === 0;
    if (audioOnly) return <AudioStream stream={stream} />
    return <VideoStream stream={stream} />
}

export default Stream;
