import React from "react";
import Connections from "../Connections";
import { useMQTTService } from "../../../services";
import baby_station from "../../../services/instances/baby_station";
import useServiceState from "../../../hooks/useServiceState";
import GestureHandler from "./ZoomControls/GestureHandler";
import ViewportService from "./ZoomControls/ViewportService";
import useViewport from "./useViewport";
import useRenderer from "./useRenderer";

interface Props {
    sessionActive: boolean
}

const gesture_handler = new GestureHandler();
const viewport_service = new ViewportService(0, 0);
gesture_handler.addEventListener('pan', viewport_service.handle_pan);
gesture_handler.addEventListener('zoom', viewport_service.handle_zoom);

const MediaStream: React.FunctionComponent<Props> = ({ sessionActive }) => {
    const media_device_service = baby_station.media_device_service;
    const media_device_state = useServiceState(media_device_service);
    const mqtt_service = useMQTTService();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const viewport = useViewport(viewport_service);
    const renderer = useRenderer(videoRef, canvasRef, viewport, media_device_state);

    React.useLayoutEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;

        canvas.addEventListener("touchstart", gesture_handler.handle_touchstart, { passive: false });
        canvas.addEventListener("touchmove", gesture_handler.handle_touchmove, { passive: false });
        canvas.addEventListener("touchend", gesture_handler.handle_touchend, { passive: false });
        canvas.addEventListener("touchcancel", gesture_handler.handle_touchcancel, { passive: false });

        return () => {
            canvas.removeEventListener("touchstart", gesture_handler.handle_touchstart);
            canvas.removeEventListener("touchmove", gesture_handler.handle_touchmove);
            canvas.removeEventListener("touchend", gesture_handler.handle_touchend);
            canvas.removeEventListener("touchcancel", gesture_handler.handle_touchcancel);
        };
    }, [media_device_state.media_stream_state.state]);

    // Set up video element with media stream
    React.useLayoutEffect(() => {
        if (videoRef.current === null) return;
        if (media_device_state.media_stream_state.state !== 'available') return;
        const video = videoRef.current;
        video.srcObject = media_device_state.media_stream_state.media_stream;
        const handle_loadedmetadata = () => {
            viewport_service.reset(video.videoWidth, video.videoHeight);
        }
        video.addEventListener("loadedmetadata", handle_loadedmetadata);
        return () => {
            video.removeEventListener("loadedmetadata", handle_loadedmetadata);
            video.srcObject = null;
        }
    }, [media_device_state.media_stream_state]);

    // Update renderer viewport when zoom/pan changes
    React.useEffect(() => {
        if (renderer === null) return;
        renderer.setViewport(viewport);
    }, [renderer, viewport]);

    // Set up WebRTC connections using canvas stream
    React.useEffect(() => {
        if (!sessionActive) return;
        if (media_device_state.media_stream_state.state !== 'available') return;

        const audio_tracks: MediaStreamTrack[] = [];
        media_device_state.media_stream_state.media_stream.getAudioTracks().forEach((track) => {
            audio_tracks.push(track);
        });

        const video_tracks: MediaStreamTrack[] = [];
        if (renderer !== null) {
            const canvas_stream = renderer.getCaptureStream();
            canvas_stream.getVideoTracks().forEach((track) => video_tracks.push(track));
        }

        const connections = new Connections({
            logging_service: baby_station.logging_service,
            mqtt_service,
            audio_tracks,
            video_tracks,
        });
        return connections.close;
    }, [mqtt_service, sessionActive, media_device_state.media_stream_state, renderer]);
    if (media_device_state.media_stream_state.state === 'loading') return (<div>Getting stream...</div>)
    if (media_device_state.media_stream_state.state === 'rejected') return (
        <div className="mt-3">
            <p>Failed to get stream.</p>
            <button className="btn btn-primary" onClick={media_device_service.retry_get_user_media}>
                Retry
            </button>
        </div>
    )
    // TODO render a basic audio visualizer
    if (media_device_state.video_device_id === '') return (
        <div>
            Audio only
        </div>
    )
    return (
        <div className={`video-container ${sessionActive ? 'active' : ''}`}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
            />
            <canvas ref={canvasRef} />
        </div>
    )
};

export default MediaStream;
