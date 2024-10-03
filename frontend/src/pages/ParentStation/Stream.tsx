import React from 'react';
import AudioStream from './AudioStream';
import VideoStream from './VideoStream';
import useParentStationSessionState from '../../hooks/useParentStationSessionStatus';

const Stream: React.FunctionComponent = () => {
    const parent_station_session_state = useParentStationSessionState();
    console.log(parent_station_session_state);
    if (parent_station_session_state.state !== "joined") return (
        <p>
            Waiting for stream...
        </p>
    );
    const media_stream = parent_station_session_state.client_connection.get_media_stream();
    // const audioOnly = media_stream.getVideoTracks().length === 0;
    // if (audioOnly) return <AudioStream stream={media_stream} />
    return <VideoStream stream={media_stream} />
}

export default Stream;
