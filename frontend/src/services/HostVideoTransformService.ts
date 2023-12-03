import moment from "moment";
import HostSessionService, { EventTypeHostSessionStatusChanged } from "./HostSessionService";
import MediaStreamService, { EventTypeMediaStreamStatusChanged } from "./MediaStreamService";
import format_duration from "../utils/formatDuration";
import get_video_track from "../utils/getVideoTrack";
import get_audio_track from "../utils/getAudioTrack";

export const EventTypeHostVideoTransformStatusChanged = 'host_video_transform_status_changed'

interface HostVideoTransformServiceStatusNotRunning {
    status: 'not_running';
}

interface HostVideoTransformServiceStatusRunning {
    status: 'running';
    transformed_media_stream: MediaStream;

    // TODO move these somewhere private
    video: HTMLVideoElement;
    canvas: HTMLCanvasElement;
}

export type HostVideoTransformServiceStatus = HostVideoTransformServiceStatusNotRunning | HostVideoTransformServiceStatusRunning;

interface NewHostVideoTransformServiceInput {
    media_stream_service: MediaStreamService;
    host_session_service: HostSessionService;
}

class HostVideoTransformService extends EventTarget {
    private static Canvas = {
        DefaultWidth: 640,
        DefaultHeight: 480,
        Font: '26px Arial',
        TextColor: 'white',
        Padding: 15,
    }
    private host_session_service: HostSessionService;
    private media_stream_service: MediaStreamService;
    private status: HostVideoTransformServiceStatus = { status: 'not_running' };

    constructor(input: NewHostVideoTransformServiceInput) {
        super();
        this.host_session_service = input.host_session_service;
        this.host_session_service.addEventListener(EventTypeHostSessionStatusChanged, this.handle_status_change);
        this.media_stream_service = input.media_stream_service;
        this.media_stream_service.addEventListener(EventTypeMediaStreamStatusChanged, this.handle_status_change);
    }

    public get_status = (): HostVideoTransformServiceStatus => {
        return this.status;
    }

    private set_status = (status: HostVideoTransformServiceStatus): void => {
        this.status = status;
        this.dispatchEvent(new Event(EventTypeHostVideoTransformStatusChanged));
    }

    private handle_status_change = (): void => {
        const host_session_status = this.host_session_service.get_status();
        if (host_session_status.status !== 'session_running') return this.stop_transform_if_running();
        const session_start = host_session_status.session_start;

        const media_stream_status = this.media_stream_service.get_status();
        if (media_stream_status.status !== 'running') return this.stop_transform_if_running();
        const media_stream = media_stream_status.media_stream;

        this.start_transform_if_not_running(media_stream, session_start);
    }

    private start_transform_if_not_running = (media_stream: MediaStream, session_start: moment.Moment) => {
        if (this.status.status === 'running') return media_stream;

        const video_track = get_video_track(media_stream);
        if (video_track === null) return;
        const video_settings = video_track.getSettings();

        const video = document.createElement('video');
        video.muted = true;
        video.autoplay = true;
        video.srcObject = new MediaStream([video_track]);

        const canvas = document.createElement('canvas');
        canvas.width = video_settings.width || HostVideoTransformService.Canvas.DefaultWidth;
        canvas.height = video_settings.height || HostVideoTransformService.Canvas.DefaultHeight;
        const ctx = canvas.getContext('2d');
        if (ctx === null)
            throw new Error('Could not get canvas context');
        ctx.font = HostVideoTransformService.Canvas.Font;
        ctx.fillStyle = HostVideoTransformService.Canvas.TextColor;
        const transformed_media_stream = canvas.captureStream();
        const audio_track = get_audio_track(media_stream);
        if (audio_track === null) throw new Error('Could not get audio track');
        transformed_media_stream.addTrack(audio_track.clone());

        this.set_status({
            status: 'running',
            transformed_media_stream,
            video,
            canvas,
        });

        const render_frame = (): void => {
            if (this.status.status !== 'running') return;

            const now = moment();
            const dt = moment.duration(session_start.diff(now));
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const text = format_duration(dt);
            const text_metrics = ctx.measureText(text);
            const text_height = text_metrics.actualBoundingBoxAscent + text_metrics.actualBoundingBoxDescent;
            const x = (canvas.width - text_metrics.width) / 2;
            const y = HostVideoTransformService.Canvas.Padding + text_height;
            ctx.fillText(text, x, y);
            requestAnimationFrame(render_frame);
        }
        render_frame();
    }

    private stop_transform_if_running = (): void => {
        if (this.status.status !== 'running') return;
        const { transformed_media_stream, video, canvas } = this.status;

        transformed_media_stream.getTracks().forEach(track => track.stop());
        video.remove();
        canvas.remove();
        this.set_status({ status: 'not_running' });
    }
}

export default HostVideoTransformService;
