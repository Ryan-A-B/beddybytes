import React from 'react';

interface Props {
    stream: MediaStream
}

const VideoStream: React.FunctionComponent<Props> = ({ stream }) => {
    const htmlVideoElementRef = React.useRef<HTMLVideoElement>(null);
    React.useLayoutEffect(() => {
        if (htmlVideoElementRef.current === null)
            throw new Error("videoRef.current is null");
        const htmlVideoElement = htmlVideoElementRef.current
        htmlVideoElement.srcObject = stream;
        htmlVideoElement.play();
        return () => {
            if (document.fullscreenEnabled && document.fullscreenElement !== null)
                document.exitFullscreen();
            if (document.pictureInPictureEnabled && document.pictureInPictureElement !== null)
                document.exitPictureInPicture();
            htmlVideoElement.srcObject = null;
        }
    }, [stream])
    return (
        <video ref={htmlVideoElementRef} playsInline className="video" />
    )
}

export default VideoStream;
