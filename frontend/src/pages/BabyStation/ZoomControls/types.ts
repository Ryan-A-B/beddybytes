/**
 * TypeScript type definitions for camera zoom feature
 * Based on: /specs/001-camera-zoom/contracts/typescript-interfaces.md
 */

/**
 * Represents the full unzoomed camera frame from device.
 * Properties are immutable after initialization.
 */
export interface CameraFrame {
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
  readonly videoElement: HTMLVideoElement;
}

/**
 * Result of canvas rendering operation.
 */
export interface RenderResult {
  success: boolean;
  frameTime: number;  // Time taken to render frame (ms)
  error?: Error;
}

/**
 * Renders video frame to canvas with viewport transform.
 */
export interface ICanvasRenderer {
  /** Start rendering loop */
  start(): void;
  
  /** Stop rendering loop */
  stop(): void;
  
  /** Check if rendering is active */
  isRendering(): boolean;
  
  /** Get current frame rate */
  getFrameRate(): number;
  
  /** Get MediaStream from canvas */
  getCaptureStream(): MediaStream;
}
