import React from "react";
import Connections from "./Connections";
import { useSignalService } from "../../services";
import baby_station from "../../services/instances/baby_station";
import useServiceState from "../../hooks/useServiceState";
import { CanvasRenderer } from "./ZoomControls/CanvasRenderer";
import GestureHandler from "./ZoomControls/GestureHandler";
import ViewportService from "./ZoomControls/ViewportService";
import useViewport from "../../hooks/useViewport";

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
    const signal_service = useSignalService();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const rendererRef = React.useRef<CanvasRenderer | null>(null);
    const viewport = useViewport(viewport_service);

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

    // Initialize canvas dimensions when video metadata loads
    React.useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const handle_loadedmetadata = () => {
            // Match canvas size to video dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Create and start renderer
            const renderer = new CanvasRenderer(canvas, video, viewport);
            rendererRef.current = renderer;
            renderer.start();
        };

        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            handle_loadedmetadata();
        } else {
            video.addEventListener("loadedmetadata", handle_loadedmetadata);
        }

        return () => {
            video.removeEventListener("loadedmetadata", handle_loadedmetadata);
            if (rendererRef.current === null) return;
            rendererRef.current.stop();
            rendererRef.current = null;
        };
    }, [media_device_state.media_stream_state, media_device_state.video_device_id]);

    // Update renderer viewport when zoom/pan changes
    React.useEffect(() => {
        if (rendererRef.current === null) return;
        rendererRef.current.setViewport(viewport);
    }, [viewport]);

    // Set up WebRTC connections using canvas stream
    React.useEffect(() => {
        if (!sessionActive) return;
        if (media_device_state.media_stream_state.state !== 'available') return;

        const audio_tracks: MediaStreamTrack[] = [];
        media_device_state.media_stream_state.media_stream.getAudioTracks().forEach((track) => {
            audio_tracks.push(track);
        });

        const video_tracks: MediaStreamTrack[] = [];
        if (rendererRef.current !== null) {
            const canvas_stream = rendererRef.current.getCaptureStream();
            canvas_stream.getVideoTracks().forEach((track) => video_tracks.push(track));
        }

        const connections = new Connections({
            logging_service: baby_station.logging_service,
            signal_service: signal_service,
            audio_tracks,
            video_tracks,
        });
        return connections.close;
    }, [signal_service, sessionActive, media_device_state.media_stream_state]);
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