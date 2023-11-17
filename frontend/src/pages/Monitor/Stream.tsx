import React from 'react';
import AudioStream from './AudioStream';
import VideoStream from './VideoStream';

interface Props {
    stream: MediaStream
}

const Stream: React.FunctionComponent<Props> = ({ stream }) => {
    const audioOnly = stream.getVideoTracks().length === 0;
    if (audioOnly) return <AudioStream stream={stream} />
    return <VideoStream stream={stream} />
}

export default Stream;
