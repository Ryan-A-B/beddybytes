import React, { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faStop, faVolumeMute, faVolumeUp, faExpand, faCompress, faWindowRestore, faPlayCircle } from "@fortawesome/free-solid-svg-icons";
import logging_service from "../../services/instances/logging_service";
import { Severity } from "../../services/LoggingService";
import parent_station from "../../services/instances/parent_station";
import useServiceState from "../../hooks/useServiceState";
import { add_fullscreen_change_listener, exit_fullscreen, is_fullscreen, remove_fullscreen_change_listener, request_fullscreen } from "../../utils/fullscreen";

// TODO finishing recording causes iOS to redirect to a download page

const pictureInPictureSupported = document.pictureInPictureEnabled === true;

const Video: React.ForwardRefRenderFunction<HTMLVideoElement> = (props, ref) => {
    const video_element_ref = useRef<HTMLVideoElement>(null);
    const recording_state = useServiceState(parent_station.recording_service);
    const [isMuted, setIsMuted] = React.useState(false);
    const [volume, setVolume] = React.useState(1);
    const [isFullScreen, setIsFullScreen] = React.useState(is_fullscreen());
    const [isPlaying, setIsPlaying] = useState(false);

    React.useLayoutEffect(() => {
        const video_element = video_element_ref.current;
        if (video_element === null) return;
        setIsMuted(video_element.muted);
        setVolume(video_element.volume);
        video_element.srcObject = parent_station.media_stream;
        setIsPlaying(!video_element.paused);

        const handle_fullscreen_change = () => {
            setIsFullScreen(is_fullscreen());
        }

        add_fullscreen_change_listener(video_element, handle_fullscreen_change);

        const handlePlay = () => setIsPlaying(true);
        const handlePause = async () => {
            setIsPlaying(false);
            try {
                await video_element.play()
            } catch (error) {
                logging_service.log({
                    severity: Severity.Warning,
                    message: "Failed to automatically resume video playback after pause",
                });
            }
        }

        video_element.addEventListener('play', handlePlay);
        video_element.addEventListener('pause', handlePause);

        return () => {
            remove_fullscreen_change_listener(video_element, handle_fullscreen_change);
            video_element.removeEventListener('play', handlePlay);
            video_element.removeEventListener('pause', handlePause);
        };
    }, [video_element_ref]);

    usePlay(video_element_ref);

    const handleMute = React.useCallback(() => {
        const video_element = video_element_ref.current;
        if (video_element === null) return;
        video_element.muted = !isMuted;
        setIsMuted(!isMuted);
    }, [isMuted]);

    const handleVolumeChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const video_element = video_element_ref.current;
        if (video_element === null) return;
        video_element.volume = Number(event.target.value);
        setVolume(Number(event.target.value));
    }, []);

    const handleFullScreen = React.useCallback(() => {
        const video_element = video_element_ref.current;
        if (video_element === null) return;
        if (!isFullScreen) request_fullscreen(video_element);
        else exit_fullscreen(document);
        setIsFullScreen(!isFullScreen);
    }, [isFullScreen]);

    const handlePictureInPicture = React.useCallback(() => {
        const video_element = video_element_ref.current;
        if (video_element === null) return;
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch((error: unknown) => {
                logging_service.log({
                    severity: Severity.Critical,
                    message: `Error exiting Picture-in-Picture mode: ${error}`,
                });
            });
        } else {
            video_element.requestPictureInPicture().catch((error: unknown) => {
                logging_service.log({
                    severity: Severity.Critical,
                    message: `Error entering Picture-in-Picture mode: ${error}`,
                });
            });
        }
    }, []);

    const handlePlayButtonClick = () => {
        const video_element = video_element_ref.current;
        if (video_element === null) return;
        video_element.play();
    };

    return (
        <div className="video-container">
            <video
                id="video-parent-station"
                ref={video_element_ref}
                controls={false}
                playsInline
                autoPlay
            />
            {!isPlaying && (
                <button
                    className="btn btn-lg btn-outline-secondary btn-play-overlay"
                    onClick={handlePlayButtonClick}
                >
                    <FontAwesomeIcon icon={faPlayCircle} />
                </button>
            )}
            <div className="video-controls p-2">
                <div className="row align-items-center g-2">
                    <div className="col-auto">
                        {recording_state.name === "recording" && (
                            <button
                                type="button"
                                onClick={parent_station.recording_service.stop}
                                id="button-stop-recording"
                                title="Stop recording"
                                className="btn btn-outline-danger"
                            >
                                <FontAwesomeIcon icon={faStop} />
                            </button>
                        )}
                        {recording_state.name === "not_recording" && (
                            <button
                                type="button"
                                onClick={parent_station.recording_service.start}
                                id="button-start-recording"
                                title="Record"
                                className="btn btn-outline-danger"
                            >
                                <FontAwesomeIcon icon={faCircle} />
                            </button>
                        )}
                    </div>
                    <div className="col-auto">
                        <button
                            type="button"
                            onClick={handleMute}
                            className="btn btn-outline-secondary"
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            <FontAwesomeIcon icon={isMuted ? faVolumeMute : faVolumeUp} />
                        </button>
                    </div>
                    {!isMuted && (
                        <div className="col-auto">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="volume-slider"
                                title="Volume"
                            />
                        </div>
                    )}
                    <div className="col-auto ms-auto">
                        <button
                            type="button"
                            onClick={handleFullScreen}
                            className="btn btn-outline-secondary"
                            title={isFullScreen ? "Exit full screen" : "Full screen"}
                        >
                            <FontAwesomeIcon icon={isFullScreen ? faCompress : faExpand} />
                        </button>
                    </div>
                    {pictureInPictureSupported && (
                        <div className="col-auto">
                            <button
                                type="button"
                                onClick={handlePictureInPicture}
                                className="btn btn-outline-secondary"
                                title="Picture-in-Picture"
                            >
                                <FontAwesomeIcon icon={faWindowRestore} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.forwardRef(Video);

const usePlay = (video_element_ref: React.RefObject<HTMLVideoElement>) => {
    const session_state = useServiceState(parent_station.session_service);
    React.useLayoutEffect(() => {
        const video_element = video_element_ref.current;
        if (video_element === null) return;
        if (session_state.state !== "joined") return;
        const connection = session_state.connection;
        const handle_connection_state_change = () => {
            const connection_state = connection.get_state();
            if (connection_state.state !== "connected") return;
            if (!video_element.paused) return;
            video_element.play().catch((error: unknown) => {
                const is_error = error instanceof Error;
                if (!is_error) {
                    logging_service.log({
                        severity: Severity.Critical,
                        message: `Error playing video element in ParentStation usePlay: ${error}`,
                    })
                    return;
                }
                logging_service.log({
                    severity: Severity.Critical,
                    message: `Error playing video element in ParentStation usePlay: ${error.message} ${error.stack}`,
                })
            });
        }
        connection.addEventListener("state_changed", handle_connection_state_change);
        return () => {
            connection.removeEventListener("state_changed", handle_connection_state_change);
        }
    }, [video_element_ref, session_state]);
}