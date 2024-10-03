import React from "react";
import Connections from "./Connections";
import { useSignalService } from "../../services";
import useMediaStreamStatus from "../../hooks/useMediaStreamStatus";
import get_audio_noise_track from "../../utils/get_audio_noise_track";
import baby_station from "../../services/instances/baby_station";
import CanvasService from "../../services/BabyStation/CanvasService";
import get_video_track_with_timestamps from "./get_video_track_with_timestamps";

const useCanvasService = (media_stream_status: MediaStreamStatus) => {
    const [video_track, set_video_track] = React.useState<MediaStreamTrack | null>(null);
    React.useEffect(() => {
        if (media_stream_status.status !== 'running') return;
        const canvas_service = new CanvasService(media_stream_status.media_stream);
        set_video_track(canvas_service.get_video_track());
        return canvas_service.stop_rendering;
    }, [media_stream_status]);
    return video_track;
}

interface Props {
    audioDeviceID: string
    videoDeviceID: string
    sessionActive: boolean
}

const MediaStreamComponent: React.FunctionComponent<Props> = ({ audioDeviceID, videoDeviceID, sessionActive }) => {
    const media_stream_service = baby_station.media_stream_service;
    const signal_service = useSignalService();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const mediaStreamStatus = useMediaStreamStatus();
    const start_media_stream = React.useCallback(async () => {
        await media_stream_service.start_media_stream({
            audio_device_id: audioDeviceID,
            video_device_id: videoDeviceID,
        });
    }, [media_stream_service, audioDeviceID, videoDeviceID]);
    React.useLayoutEffect(() => {
        if (videoRef.current === null) return;
        if (mediaStreamStatus.status !== 'running') return;
        const video_tracks = mediaStreamStatus.media_stream.getVideoTracks();
        if (video_tracks.length !== 1) throw new Error('Expected exactly one video track');
        const video_track = video_tracks[0];
        const video_track_with_timestamps = get_video_track_with_timestamps(video_track);
        const video_element = videoRef.current;
        video_element.srcObject = mediaStreamStatus.media_stream;
        video_element.play();
        return () => {
            video_element.srcObject = null;
        }
    }, [mediaStreamStatus]);
    React.useEffect(() => {
        if (!sessionActive) return;
        if (mediaStreamStatus.status !== 'running') return;
        const video_tracks = mediaStreamStatus.media_stream.getVideoTracks();
        if (video_tracks.length !== 1) throw new Error('Expected exactly one video track');
        const video_track = video_tracks[0];
        const audio_tracks = mediaStreamStatus.media_stream.getAudioTracks();
        audio_tracks.push(get_audio_noise_track());
        const connections = new Connections(signal_service, video_track, audio_tracks);
        return connections.close;
    }, [signal_service, sessionActive, mediaStreamStatus]);
    if (mediaStreamStatus.status === 'starting') return (<div>Getting stream...</div>)
    if (mediaStreamStatus.status === 'rejected') return (
        <div className="mt-3">
            <p>Failed to get stream.</p>
            <button className="btn btn-primary" onClick={start_media_stream}>
                Retry
            </button>
        </div>
    )
    // TODO render a basic audio visualizer
    if (videoDeviceID === '') return (
        <div>
            Audio only
        </div>
    )
    return (
        <video
            ref={videoRef}
            playsInline
            muted
            className={`video my-3 ${sessionActive && 'active'}`}
        />
    )
};

export default MediaStreamComponent;