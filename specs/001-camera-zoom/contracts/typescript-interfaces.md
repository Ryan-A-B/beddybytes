# TypeScript Interface Contracts

**Date**: 2026-01-23  
**Feature**: 001-camera-zoom  
**Purpose**: Define TypeScript interfaces for type safety and module boundaries

## Core Interfaces

### Viewport State

```typescript
/**
 * Represents the visible portion of the camera frame being displayed and transmitted.
 * All pan coordinates are in source video pixel space.
 */
export interface ViewportState {
  /** Zoom level multiplier (1.0 = 100%, 3.0 = 300%) */
  zoom: number;
  
  /** Horizontal offset in pixels from top-left of camera frame */
  panX: number;
  
  /** Vertical offset in pixels from top-left of camera frame */
  panY: number;
}

/**
 * Viewport with calculated dimensions (read-only properties).
 */
export interface Viewport extends ViewportState {
  /** Width of visible viewport in source pixels (videoWidth / zoom) */
  readonly width: number;
  
  /** Height of visible viewport in source pixels (videoHeight / zoom) */
  readonly height: number;
}
```

### Gesture Events

```typescript
/** Type of touch gesture recognized */
export type GestureType = 'pinch' | 'pan' | 'doubleTap';

/** 2D point in client coordinates */
export interface Point {
  x: number;
  y: number;
}

/**
 * Base gesture event with common properties.
 */
export interface BaseGestureEvent {
  type: GestureType;
  timestamp: number;
  touchCount: 1 | 2;
}

/**
 * Pinch gesture for zoom control.
 * Requires two touch points.
 */
export interface PinchGestureEvent extends BaseGestureEvent {
  type: 'pinch';
  touchCount: 2;
  distance: number;           // Current distance between touch points
  previousDistance: number;   // Previous distance
  scale: number;              // distance / previousDistance
}

/**
 * Pan gesture for viewport movement when zoomed.
 * Requires single touch point and zoom > 1.0.
 */
export interface PanGestureEvent extends BaseGestureEvent {
  type: 'pan';
  touchCount: 1;
  startPoint: Point;
  currentPoint: Point;
  deltaX: number;  // currentPoint.x - startPoint.x
  deltaY: number;  // currentPoint.y - startPoint.y
}

/**
 * Double-tap gesture for zoom reset.
 */
export interface DoubleTapGestureEvent extends BaseGestureEvent {
  type: 'doubleTap';
  touchCount: 1;
  point: Point;
}

/** Union of all gesture event types */
export type GestureEvent = PinchGestureEvent | PanGestureEvent | DoubleTapGestureEvent;
```

### Camera Frame

```typescript
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
```

### Canvas Renderer

```typescript
/**
 * Configuration for canvas rendering of zoomed/panned viewport.
 */
export interface CanvasRenderConfig {
  canvas: HTMLCanvasElement;
  sourceVideo: HTMLVideoElement;
  viewport: ViewportState;
}

/**
 * Result of canvas rendering operation.
 */
export interface RenderResult {
  success: boolean;
  frameTime: number;  // Time taken to render frame (ms)
  error?: Error;
}
```

## Component Props

### ZoomControls Component

```typescript
/**
 * Props for ZoomControls component that handles touch gestures.
 */
export interface ZoomControlsProps {
  /** HTML video element displaying camera feed */
  videoElement: HTMLVideoElement;
  
  /** HTML canvas element for rendering transformed video */
  canvasElement: HTMLCanvasElement;
  
  /** Callback when zoom level changes */
  onZoomChange?: (zoom: number) => void;
  
  /** Callback when pan position changes */
  onPanChange?: (panX: number, panY: number) => void;
  
  /** Whether zoom controls are enabled */
  enabled: boolean;
}
```

### ViewportIndicator Component (Optional)

```typescript
/**
 * Props for visual feedback component showing current zoom state.
 */
export interface ViewportIndicatorProps {
  /** Current viewport state */
  viewport: ViewportState;
  
  /** Whether indicator should be visible */
  visible: boolean;
  
  /** Auto-hide delay in milliseconds (0 = no auto-hide) */
  autoHideDelay?: number;
}
```

## Hook Interfaces

### useZoomGestures Hook

```typescript
/**
 * Return value from useZoomGestures custom hook.
 */
export interface UseZoomGesturesResult {
  /** Current viewport state */
  viewport: ViewportState;
  
  /** Update zoom level (will be constrained to valid range) */
  updateZoom: (newZoom: number) => void;
  
  /** Update pan position (will be constrained to bounds) */
  updatePan: (deltaX: number, deltaY: number) => void;
  
  /** Reset viewport to default (zoom=1.0, pan=0,0) */
  resetViewport: () => void;
  
  /** Whether viewport is at default state */
  isDefaultViewport: boolean;
}

/**
 * Configuration for useZoomGestures hook.
 */
export interface UseZoomGesturesConfig {
  /** Reference to video element for dimension calculations */
  videoRef: React.RefObject<HTMLVideoElement>;
  
  /** Reference to canvas element for touch event handling */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  
  /** Minimum zoom level (default: 1.0) */
  minZoom?: number;
  
  /** Maximum zoom level (default: 3.0) */
  maxZoom?: number;
  
  /** Whether gestures are enabled */
  enabled: boolean;
}
```

## Service/Manager Interfaces

### ViewportManager

```typescript
/**
 * Manages viewport state and enforces constraints.
 */
export interface IViewportManager {
  /** Get current viewport state */
  getViewport(): Viewport;
  
  /** Set zoom level (constrained to valid range) */
  setZoom(zoom: number): void;
  
  /** Set pan position (constrained to bounds) */
  setPan(panX: number, panY: number): void;
  
  /** Apply pan delta (relative movement) */
  applyPanDelta(deltaX: number, deltaY: number): void;
  
  /** Reset to default viewport */
  reset(): void;
  
  /** Check if viewport is at default state */
  isDefault(): boolean;
}
```

### GestureHandler

```typescript
/**
 * Recognizes touch gestures and emits gesture events.
 */
export interface IGestureHandler {
  /** Attach to canvas element to start listening */
  attach(canvas: HTMLCanvasElement): void;
  
  /** Detach and stop listening */
  detach(): void;
  
  /** Add event listener for gesture events */
  addEventListener(type: 'gesture', listener: (event: GestureEvent) => void): void;
  
  /** Remove event listener */
  removeEventListener(type: 'gesture', listener: (event: GestureEvent) => void): void;
}
```

### CanvasRenderer

```typescript
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
```

## Validation Function Signatures

```typescript
/**
 * Constrain viewport to valid bounds given camera frame dimensions.
 */
export function constrainViewport(
  viewport: ViewportState,
  videoWidth: number,
  videoHeight: number
): ViewportState;

/**
 * Calculate maximum pan values for given zoom level.
 */
export function getMaxPan(
  zoom: number,
  videoWidth: number,
  videoHeight: number
): { maxPanX: number; maxPanY: number };

/**
 * Calculate viewport dimensions for given zoom level.
 */
export function getViewportDimensions(
  zoom: number,
  videoWidth: number,
  videoHeight: number
): { width: number; height: number };

/**
 * Type guard for pinch gesture.
 */
export function isPinchGesture(event: GestureEvent): event is PinchGestureEvent;

/**
 * Type guard for pan gesture.
 */
export function isPanGesture(event: GestureEvent): event is PanGestureEvent;

/**
 * Type guard for double-tap gesture.
 */
export function isDoubleTapGesture(event: GestureEvent): event is DoubleTapGestureEvent;
```

## Constants

```typescript
/** Default viewport state */
export const DEFAULT_VIEWPORT: ViewportState = {
  zoom: 1.0,
  panX: 0,
  panY: 0
};

/** Zoom constraints */
export const ZOOM_CONSTRAINTS = {
  MIN: 1.0,
  MAX: 3.0,
  DEFAULT: 1.0
} as const;

/** Performance targets */
export const PERFORMANCE_TARGETS = {
  MIN_FPS: 15,
  TARGET_FPS: 30,
  MAX_GESTURE_LATENCY_MS: 50,
  RESET_ANIMATION_MS: 300
} as const;

/** Gesture recognition thresholds */
export const GESTURE_THRESHOLDS = {
  DOUBLE_TAP_MAX_DELAY_MS: 300,
  DOUBLE_TAP_MAX_MOVEMENT_PX: 10,
  MIN_PINCH_DELTA: 10,  // Minimum distance change to recognize pinch
  MIN_PAN_DELTA: 5      // Minimum movement to recognize pan
} as const;
```

## Module Boundaries

### Internal Contracts (Not Exported)

- Touch event tracking state
- Gesture recognition internal state
- Canvas rendering loop internals

### External Contracts (Exported)

- `ViewportState`, `Viewport` - consumed by parent components
- `GestureEvent` types - for testing and debugging
- Hook return types (`UseZoomGesturesResult`) - public API
- Component props interfaces - React component boundaries
- Validation functions - utility functions for external use

## Type Safety Guarantees

1. **Viewport Constraints**: All viewport mutations go through `constrainViewport()` function
2. **Gesture Discrimination**: TypeScript discriminated unions ensure type-safe gesture handling
3. **Read-Only Properties**: `readonly` modifier prevents accidental mutation of calculated values
4. **Non-Null Canvas/Video**: Refs are checked before operations (non-null assertions avoided)

