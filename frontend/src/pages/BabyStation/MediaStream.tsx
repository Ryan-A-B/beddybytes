import React from "react";
import Connections from "./Connections";
import { useSignalService } from "../../services";
import add_audio_noise from "../../utils/add_audio_noise";
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

        const handleLoadedMetadata = () => {
            // Match canvas size to video dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Create and start renderer
            const renderer = new CanvasRenderer(canvas, video, viewport);
            rendererRef.current = renderer;
            renderer.start();
        };

        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            handleLoadedMetadata();
        } else {
            video.addEventListener("loadedmetadata", handleLoadedMetadata);
        }

        return () => {
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            if (rendererRef.current) {
                rendererRef.current.stop();
                rendererRef.current = null;
            }
        };
    }, [media_device_state.media_stream_state, media_device_state.video_device_id]);

    // Update renderer viewport when zoom/pan changes
    React.useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.setViewport(viewport);
        }
    }, [viewport]);

    // Set up WebRTC connections using canvas stream
    React.useEffect(() => {
        if (!sessionActive) return;
        if (media_device_state.media_stream_state.state !== 'available') return;
        if (!rendererRef.current) return;

        // Get canvas stream (video only) and add audio from original stream
        const canvas_stream = rendererRef.current.getCaptureStream();
        const original_stream = media_device_state.media_stream_state.media_stream;

        // Add audio tracks from original stream to canvas stream
        original_stream.getAudioTracks().forEach((track) => {
            canvas_stream.addTrack(track);
        });

        const media_stream = add_audio_noise(canvas_stream);
        const connections = new Connections({
            logging_service: baby_station.logging_service,
            signal_service: signal_service,
            stream: media_stream,
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