import React from 'react';

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
        htmlAudioElement.play();
        return () => {
            htmlAudioElement.srcObject = null;
        }
    }, [stream])
    return (
        <React.Fragment>
            <p>Audio only</p>
            <audio ref={htmlAudioElementRef} playsInline />
        </React.Fragment>
    )
}

export default AudioStream;