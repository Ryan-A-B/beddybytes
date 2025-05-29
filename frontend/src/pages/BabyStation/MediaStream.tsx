import React from "react";
import Connections from "./Connections";
import { useSignalService } from "../../services";
import add_audio_noise from "../../utils/add_audio_noise";
import baby_station from "../../services/instances/baby_station";
import useServiceState from "../../hooks/useServiceState";

interface Props {
    sessionActive: boolean
}

const MediaStream: React.FunctionComponent<Props> = ({ sessionActive }) => {
    const media_device_service = baby_station.media_device_service;
    const media_device_state = useServiceState(media_device_service);
    const signal_service = useSignalService();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    React.useLayoutEffect(() => {
        if (media_device_state.media_stream_state.state !== 'available') return;
        if (videoRef.current === null) return;
        const video = videoRef.current;
        video.srcObject = media_device_state.media_stream_state.media_stream;
        return () => {
            video.srcObject = null;
        }
    }, [media_device_state.media_stream_state]);
    React.useEffect(() => {
        if (!sessionActive) return;
        if (media_device_state.media_stream_state.state !== 'available') return;
        const media_stream = add_audio_noise(media_device_state.media_stream_state.media_stream);
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
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`video my-3 ${sessionActive && 'active'}`}
        />
    )
};

export default MediaStream;