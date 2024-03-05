import React from 'react';
import ConnectionState from './ConnectionState';

interface Props {
    stream: MediaStream
}

const AudioStream: React.FunctionComponent<Props> = ({ stream }) => {
    const htmlAudioElementRef = React.useRef<HTMLAudioElement>(null);
    React.useLayoutEffect(() => {
        if (htmlAudioElementRef.current === null)
            throw new Error("videoRef.current is null");
        const htmlAudioElement = htmlAudioElementRef.current
        htmlAudioElement.srcObject = stream;
        return () => {
            htmlAudioElement.srcObject = null;
        }
    }, [stream])
    // TODO what's playsInline?
    return (
        <React.Fragment>
            <p id="audio-only-message">Audio only</p>
            <ConnectionState stream={stream} />
            <audio id="audio-parent" ref={htmlAudioElementRef} playsInline autoPlay />
        </React.Fragment>
    )
}

export default AudioStream;