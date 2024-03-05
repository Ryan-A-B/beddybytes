import React from 'react';
import ConnectionState from './ConnectionState';

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
        return () => {
            if (document.fullscreenEnabled && document.fullscreenElement !== null)
                document.exitFullscreen();
            if (document.pictureInPictureEnabled && document.pictureInPictureElement !== null)
                document.exitPictureInPicture();
            htmlVideoElement.srcObject = null;
        }
    }, [stream])
    // TODO what's playsInline?
    return (
        <React.Fragment>
            <ConnectionState stream={stream} />
            <video id="video-parent" ref={htmlVideoElementRef} autoPlay playsInline className="video" />
        </React.Fragment>
    )
}

export default VideoStream;
