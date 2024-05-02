import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ConnectionState from './ConnectionState';
import parent_station from '../../services/instances/parent_station';
import useRecordingState from '../../hooks/useRecordingState';
import { faCircle, faStop } from '@fortawesome/free-solid-svg-icons';

interface Props {
    stream: MediaStream
}

const VideoStream: React.FunctionComponent<Props> = ({ stream }) => {
    const htmlVideoElementRef = React.useRef<HTMLVideoElement>(null);
    const recording_state = useRecordingState(parent_station.recording_service);
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
            {recording_state.state === 'not_recording' && (
                <button id="button-start-recording" onClick={parent_station.recording_service.start} className='btn btn-outline-danger'>
                    <FontAwesomeIcon icon={faCircle} /> Start Recording
                </button>
            )}
            {recording_state.state === 'recording' && (
                <button id="button-stop-recording" onClick={parent_station.recording_service.stop} className='btn btn-outline-success'>
                    <FontAwesomeIcon icon={faStop} /> Stop Recording
                </button>
            )}
            <video id="video-parent" ref={htmlVideoElementRef} autoPlay playsInline className="video" />
        </React.Fragment>
    )
}

export default VideoStream;
