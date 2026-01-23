# Data Model: Camera Zoom

**Date**: 2026-01-23  
**Feature**: 001-camera-zoom  
**Purpose**: Define entities, their properties, relationships, and validation rules

## Entities

### 1. Viewport

**Description**: The visible portion of the camera frame currently being displayed and transmitted to parent stations.

**Properties**:

| Property | Type | Range/Constraint | Default | Description |
|----------|------|------------------|---------|-------------|
| `zoom` | `number` | 1.0 - 3.0 | 1.0 | Zoom level as multiplier (1.0 = 100%, 3.0 = 300%) |
| `panX` | `number` | 0 - maxPanX* | 0 | Horizontal offset in pixels from top-left of camera frame |
| `panY` | `number` | 0 - maxPanY* | 0 | Vertical offset in pixels from top-left of camera frame |
| `width` | `number` | > 0 | calculated | Width of visible viewport in source pixels (videoWidth / zoom) |
| `height` | `number` | > 0 | calculated | Height of visible viewport in source pixels (videoHeight / zoom) |

\* **Dynamic constraints**:
- `maxPanX = videoWidth - (videoWidth / zoom)`
- `maxPanY = videoHeight - (videoHeight / zoom)`

**Derived Properties**:
```typescript
interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
  
  // Calculated (read-only)
  width: number;   // videoWidth / zoom
  height: number;  // videoHeight / zoom
}
```

**Validation Rules**:
1. `zoom >= 1.0 && zoom <= 3.0` (FR-003, FR-004)
2. `panX >= 0 && panX <= maxPanX` (FR-006)
3. `panY >= 0 && panY <= maxPanY` (FR-006)
4. When `zoom === 1.0`, `panX === 0 && panY === 0` (fully zoomed out = centered)

**State Transitions**:
- **Zoom In**: `zoom` increases, `width` and `height` decrease, `maxPanX` and `maxPanY` increase
- **Zoom Out**: `zoom` decreases, `width` and `height` increase, `maxPanX` and `maxPanY` decrease
- **Pan**: Only `panX` and/or `panY` change (requires `zoom > 1.0`)
- **Reset**: All properties return to default values

**Relationships**:
- **Contains**: CameraFrame (1:1) - viewport is a window into the camera frame
- **Generates**: VideoStream (1:1) - viewport defines what is captured to stream
- **Updated By**: GestureEvent (many:1) - gestures modify viewport properties

---

### 2. CameraFrame

**Description**: The full unzoomed video frame from the device camera. Represents the maximum available view area.

**Properties**:

| Property | Type | Constraint | Description |
|----------|------|------------|-------------|
| `width` | `number` | > 0, read-only | Native video width in pixels (e.g., 1920 for 1080p) |
| `height` | `number` | > 0, read-only | Native video height in pixels (e.g., 1080 for 1080p) |
| `aspectRatio` | `number` | > 0, read-only | width / height (e.g., 16/9 = 1.778) |
| `videoElement` | `HTMLVideoElement` | non-null | Reference to video element receiving getUserMedia stream |

**Derived Properties**:
```typescript
interface CameraFrame {
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
  readonly videoElement: HTMLVideoElement;
}
```

**Validation Rules**:
1. Properties are immutable after initialization (camera resolution doesn't change during session)
2. `aspectRatio === width / height` (FR-023: preserve aspect ratio)
3. `videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA` (video ready to render)

**State Transitions**:
- **Initialized**: When getUserMedia resolves and video metadata loaded
- **Unchanged**: Properties remain constant for session duration
- **Destroyed**: When session ends or video device changes

**Relationships**:
- **Contains**: Viewport (1:1) - camera frame is the source for viewport
- **Provides**: VideoStream (1:1) - via canvas rendering pipeline

---

### 3. GestureEvent

**Description**: Touch interaction from user including type, coordinates, and delta values used to calculate viewport changes.

**Properties**:

| Property | Type | Constraint | Description |
|----------|------|------------|-------------|
| `type` | `GestureType` | enum: `pinch`, `pan`, `doubleTap` | Type of gesture recognized |
| `timestamp` | `number` | > 0 | DOMHighResTimeStamp from performance.now() |
| `touchCount` | `number` | 1 or 2 | Number of simultaneous touch points |
| `startPoint` | `Point` | optional | Initial touch coordinates (for pan) |
| `currentPoint` | `Point` | optional | Current touch coordinates (for pan) |
| `distance` | `number` | optional, > 0 | Distance between two touch points (for pinch) |
| `previousDistance` | `number` | optional, > 0 | Previous distance between touch points (for pinch) |
| `scale` | `number` | optional, > 0 | currentDistance / previousDistance (for pinch) |

**Supporting Types**:
```typescript
type GestureType = 'pinch' | 'pan' | 'doubleTap';

interface Point {
  x: number;  // clientX
  y: number;  // clientY
}

interface GestureEvent {
  type: GestureType;
  timestamp: number;
  touchCount: 1 | 2;
  
  // For pan gestures
  startPoint?: Point;
  currentPoint?: Point;
  
  // For pinch gestures
  distance?: number;
  previousDistance?: number;
  scale?: number;
}
```

**Validation Rules**:
1. **Pinch**: Requires `touchCount === 2`, `distance` and `previousDistance` present
2. **Pan**: Requires `touchCount === 1`, `startPoint` and `currentPoint` present, and `currentZoom > 1.0`
3. **DoubleTap**: Requires `touchCount === 1`, two taps within 300ms threshold
4. `scale` if present: `scale = distance / previousDistance` (must be consistent)

**State Transitions**:
- **Touch Start**: Initialize gesture tracking (record start point/distance)
- **Touch Move**: Update current point/distance, calculate deltas
- **Touch End**: Finalize gesture, reset tracking state
- **Gesture Recognized**: Emit event with calculated properties

**Relationships**:
- **Updates**: Viewport (many:1) - multiple gestures modify single viewport
- **Generated By**: TouchEvent (1:1) - browser touch event → gesture event transformation

---

### 4. VideoStream

**Description**: The WebRTC media stream transmitted from baby station to parent stations, derived from the viewport via canvas capture.

**Properties**:

| Property | Type | Constraint | Description |
|----------|------|------------|-------------|
| `mediaStream` | `MediaStream` | non-null | MediaStream from canvas.captureStream() |
| `videoTrack` | `MediaStreamTrack` | non-null | Video track from stream |
| `frameRate` | `number` | 15-30 | Target frames per second (from captureStream param) |
| `width` | `number` | > 0 | Output video width (matches canvas width) |
| `height` | `number` | > 0 | Output video height (matches canvas height) |
| `isActive` | `boolean` | - | Whether stream is currently transmitting |

**Derived Properties**:
```typescript
interface VideoStream {
  readonly mediaStream: MediaStream;
  readonly videoTrack: MediaStreamTrack;
  readonly frameRate: number;
  readonly width: number;
  readonly height: number;
  readonly isActive: boolean;
}
```

**Validation Rules**:
1. `mediaStream.active === true` (stream is live)
2. `videoTrack.kind === 'video'` (correct track type)
3. `videoTrack.readyState === 'live'` (track is active)
4. `frameRate >= 15 && frameRate <= 30` (FR-021: maintain 15-30 fps)
5. `width` and `height` match canvas dimensions (no scaling)

**State Transitions**:
- **Created**: When canvas.captureStream() called
- **Active**: When added to RTCPeerConnection tracks
- **Updated**: When viewport changes (automatic - canvas rendering updates stream)
- **Inactive**: When session ends or connection closes

**Relationships**:
- **Derived From**: Viewport (1:1) - viewport defines what's captured to stream
- **Source**: CameraFrame (1:1) via canvas pipeline - ultimate source of video data
- **Consumed By**: RTCPeerConnection (1:many) - transmitted to parent stations

---

## Entity Relationships Diagram

```
CameraFrame (video source)
    │
    │ renders to
    ▼
Viewport (transform calculation)
    │
    │ defines capture region for
    ▼
Canvas (rendering + captureStream)
    │
    │ generates
    ▼
VideoStream (MediaStream)
    │
    │ transmitted via
    ▼
RTCPeerConnection → Parent Stations

GestureEvent ──updates──> Viewport
```

## Data Flow

### Initial Setup
1. getUserMedia() → CameraFrame.videoElement
2. Create Canvas matching CameraFrame dimensions
3. Initialize Viewport with default values (zoom=1.0, pan=0,0)
4. canvas.captureStream(30) → VideoStream.mediaStream
5. Add VideoStream to RTCPeerConnection tracks

### User Interaction
1. User touch → Browser TouchEvent
2. TouchEvent → GestureEvent (recognition logic)
3. GestureEvent → Viewport update (calculate new zoom/pan)
4. Viewport → Canvas redraw (render transformed frame)
5. Canvas → VideoStream automatic update (captureStream handles sync)
6. VideoStream → Parent stations receive update via WebRTC

### State Persistence
- **During Session**: Viewport maintained in React component state
- **Network Interruption**: No impact - Viewport is client-side only
- **Session End**: Viewport reset to defaults (zoom=1.0, pan=0,0)
- **Parent Station Connection**: Receives current VideoStream output (no separate sync)

## Validation Functions

```typescript
// Constrain viewport to valid bounds
const constrainViewport = (
  viewport: Viewport, 
  cameraFrame: CameraFrame
): Viewport => {
  const zoom = Math.max(1.0, Math.min(3.0, viewport.zoom));
  const maxPanX = cameraFrame.width - (cameraFrame.width / zoom);
  const maxPanY = cameraFrame.height - (cameraFrame.height / zoom);
  
  return {
    zoom,
    panX: Math.max(0, Math.min(maxPanX, viewport.panX)),
    panY: Math.max(0, Math.min(maxPanY, viewport.panY)),
    width: cameraFrame.width / zoom,
    height: cameraFrame.height / zoom
  };
};

// Validate gesture event structure
const isValidGestureEvent = (event: GestureEvent): boolean => {
  switch (event.type) {
    case 'pinch':
      return event.touchCount === 2 
        && event.distance !== undefined 
        && event.previousDistance !== undefined;
    case 'pan':
      return event.touchCount === 1 
        && event.startPoint !== undefined 
        && event.currentPoint !== undefined;
    case 'doubleTap':
      return event.touchCount === 1;
    default:
      return false;
  }
};

// Validate video stream is active
const isStreamActive = (stream: VideoStream): boolean => {
  return stream.mediaStream.active 
    && stream.videoTrack.readyState === 'live'
    && stream.isActive;
};
```

## Invariants

1. **Viewport Bounds**: At all times, `0 <= panX <= maxPanX && 0 <= panY <= maxPanY`
2. **Zoom Limits**: At all times, `1.0 <= zoom <= 3.0`
3. **Aspect Ratio**: Viewport.width / Viewport.height === CameraFrame.aspectRatio (always preserved)
4. **Stream Synchronization**: VideoStream output always reflects current Viewport state (no lag/desync)
5. **Gesture Exclusivity**: Only one gesture type active at a time (pinch OR pan OR doubleTap)

