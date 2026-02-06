/**
 * CanvasRenderer: Renders video frame to canvas with viewport transform
 * Based on: /specs/001-camera-zoom/research.md (Decision R1: Canvas Pipeline)
 */

import { ICanvasRenderer } from "./types";
import { PERFORMANCE_TARGETS } from "./constants";
import { Viewport } from "./ViewportService";

export class CanvasRenderer implements ICanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private sourceVideo: HTMLVideoElement;
    private viewport: Viewport;
    private animationFrameId: number | null = null;
    private isActive = false;

    // Frame rate tracking
    private lastFrameTime = 0;
    private frameCount = 0;
    private fps = 0;
    private fpsUpdateInterval = 1000; // Update FPS every second
    private lastFpsUpdate = 0;

    constructor(
        canvas: HTMLCanvasElement,
        sourceVideo: HTMLVideoElement,
        viewport: Viewport
    ) {
        this.canvas = canvas;
        this.sourceVideo = sourceVideo;
        this.viewport = viewport;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D context from canvas");
        }
        this.ctx = ctx;
    }

    start(): void {
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.lastFrameTime = performance.now();
        this.lastFpsUpdate = this.lastFrameTime;
        this.renderLoop();
    }

    stop(): void {
        this.isActive = false;
        if (this.animationFrameId === null) return;
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    }

    isRendering(): boolean {
        return this.isActive;
    }

    getFrameRate(): number {
        return this.fps;
    }

    getCaptureStream(): MediaStream {
        // Capture at target frame rate
        const stream = this.canvas.captureStream(PERFORMANCE_TARGETS.TARGET_FPS);
        return stream;
    }

    setViewport(viewport: Viewport): void {
        this.viewport = viewport;
    }

    private renderLoop = (): void => {
        if (!this.isActive) {
            return;
        }

        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Render frame
        this.renderFrame();

        // Update FPS counter
        this.frameCount++;
        const timeSinceLastFpsUpdate = now - this.lastFpsUpdate;
        if (timeSinceLastFpsUpdate >= this.fpsUpdateInterval) {
            this.fps = Math.round((this.frameCount * 1000) / timeSinceLastFpsUpdate);
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            // Log warning if FPS drops below minimum
            if (this.fps < PERFORMANCE_TARGETS.MIN_FPS) {
                console.warn(
                    `[CanvasRenderer] Frame rate dropped to ${this.fps} fps (target: ${PERFORMANCE_TARGETS.TARGET_FPS} fps, minimum: ${PERFORMANCE_TARGETS.MIN_FPS} fps)`
                );
            }
        }

        // Schedule next frame
        this.animationFrameId = requestAnimationFrame(this.renderLoop);
    };

    private renderFrame(): void {
        if (this.sourceVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        if (this.sourceVideo.videoWidth === 0) return;
        if (this.sourceVideo.videoHeight === 0) return;

        const videoWidth = this.sourceVideo.videoWidth;
        const videoHeight = this.sourceVideo.videoHeight;

        // Calculate source rectangle based on viewport
        const sourceWidth = this.viewport.width;
        const sourceHeight = this.viewport.height;
        const sourceX = this.viewport.offsetX;
        const sourceY = this.viewport.offsetY;

        // Draw cropped/zoomed video frame
        // drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
        // sx, sy: source x, y (where to start cropping in source)
        // sw, sh: source width, height (how much to crop)
        // dx, dy: destination x, y (where to draw on canvas - always 0,0)
        // dw, dh: destination width, height (canvas dimensions)
        this.ctx.drawImage(
            this.sourceVideo,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );
    }
}
