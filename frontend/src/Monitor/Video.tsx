import React from 'react';

interface Props {
    stream: MediaStream
}

const Video: React.FunctionComponent<Props> = ({ stream }) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    React.useEffect(() => {
        if (videoRef.current === null)
            throw new Error("videoRef.current is null");
        const video = videoRef.current
        video.srcObject = stream;
        video.play();
    }, [stream])
    return (
        <video ref={videoRef} playsInline className="video" />
    )
}

export default Video;