import React from "react";
import { CanvasRenderer } from "./ZoomControls/CanvasRenderer";
import { Viewport } from "./ZoomControls/ViewportService";
import { MediaDeviceState } from "../../../services/BabyStation/MediaDeviceService";

class CanvasRendererManager {
    private renderer: CanvasRenderer | null = null;

    get_renderer(): CanvasRenderer | null {
        return this.renderer;
    }

    create_renderer(canvas: HTMLCanvasElement, video: HTMLVideoElement, viewport: Viewport): CanvasRenderer {
        console.log("create_renderer")
        this.renderer = new CanvasRenderer(canvas, video, viewport);
        this.renderer.start();
        return this.renderer;
    }

    clear = () => {
        if (this.renderer === null) return;
        console.log("clear_renderer")
        this.renderer.stop();
        this.renderer = null;
    }
}

const manager = new CanvasRendererManager();

const useRenderer = (videoRef: React.RefObject<HTMLVideoElement>, canvasRef: React.RefObject<HTMLCanvasElement>, viewport: Viewport, media_device_state: MediaDeviceState) => {
    const [renderer, set_renderer] = React.useState<CanvasRenderer | null>(null);
    React.useEffect(() => {
        const video = videoRef.current;
        if (video === null) return;
        const canvas = canvasRef.current;
        if (canvas === null) return;

        const handle_loadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            set_renderer(manager.create_renderer(canvas, video, viewport));
        };

        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            handle_loadedmetadata();
        } else {
            video.addEventListener("loadedmetadata", handle_loadedmetadata);
        }

        return () => {
            video.removeEventListener("loadedmetadata", handle_loadedmetadata);
            manager.clear();
            set_renderer(null);
        };
    }, [media_device_state.media_stream_state]);
    return renderer;
};

export default useRenderer;
